"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorBridge, PageRenderer, RenderCtx } from "@/components/cms/PageRenderer";
import { Page, SECTION_DEFS, Section, SectionType, Theme, createSection, uid } from "@/lib/cms/schema";
import { cx } from "@/lib/format";
import { InspectorApi, SectionInspector, TextInspector, ThemeInspector, readPath, writeStyle, writeText } from "./Inspector";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };
type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  initialDraft: Page;
  initialPublished: Page;
  publishedAt: string | null;
  history: { at: string; page: Page }[];
  ctx: Omit<RenderCtx, "editor">;
  defaultPassword: boolean;
}

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");

export function Editor({ initialDraft, initialPublished, publishedAt: initialPublishedAt, history: initialHistory, ctx, defaultPassword }: Props) {
  const [page, setPage] = useState<Page>(initialDraft);
  const pageRef = useRef(page);
  const past = useRef<Page[]>([]);
  const future = useRef<Page[]>([]);
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const [, force] = useState(0);

  const [publishedJson, setPublishedJson] = useState(() => JSON.stringify(initialPublished));
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [history, setHistory] = useState(initialHistory);
  const [save, setSave] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [sel, setSel] = useState<{ section?: string; path?: string }>({});
  const [leftTab, setLeftTab] = useState<"sections" | "theme">("sections");
  const [device, setDevice] = useState<Device>("desktop");
  const [library, setLibrary] = useState(false);
  const [versions, setVersions] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  // ---------------------------------------------------------------------
  // History-aware mutation
  // ---------------------------------------------------------------------
  const commit = useCallback((next: Page, key?: string) => {
    const now = Date.now();
    const coalesce = key && lastKey.current?.key === key && now - lastKey.current.t < 1200;
    if (!coalesce) {
      past.current.push(pageRef.current);
      if (past.current.length > 150) past.current.shift();
    }
    future.current = [];
    lastKey.current = key ? { key, t: now } : null;
    pageRef.current = next;
    setPage(next);
    setDirty(true);
  }, []);

  const mutate = useCallback(
    (fn: (d: Page) => void, key?: string) => {
      const d = structuredClone(pageRef.current);
      fn(d);
      commit(d, key);
    },
    [commit]
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(pageRef.current);
    pageRef.current = prev;
    lastKey.current = null;
    setPage(prev);
    setDirty(true);
    force((x) => x + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(pageRef.current);
    pageRef.current = next;
    lastKey.current = null;
    setPage(next);
    setDirty(true);
    force((x) => x + 1);
  }, []);

  const updateSection = useCallback(
    (id: string, fn: (s: Section) => void, key?: string) =>
      mutate((d) => {
        const s = d.sections.find((x) => x.id === id);
        if (s) fn(s);
      }, key),
    [mutate]
  );

  const updateTheme = useCallback((fn: (t: Theme, p: Page) => void, key?: string) => mutate((d) => fn(d.theme, d), key), [mutate]);

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------
  const saveNow = useCallback(async () => {
    setSave("saving");
    try {
      const res = await fetch("/api/cms", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: pageRef.current }) });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return false;
      }
      if (!res.ok) throw new Error();
      setSave("saved");
      setDirty(false);
      return true;
    } catch {
      setSave("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(saveNow, 1200);
    return () => clearTimeout(t);
  }, [page, dirty, saveNow]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch("/api/cms/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: pageRef.current }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPublishedJson(JSON.stringify(pageRef.current));
      setPublishedAt(data.publishedAt);
      setDirty(false);
      setSave("saved");
      // Refresh version list
      const doc = await fetch("/api/cms").then((r) => r.json());
      setHistory(doc.history);
      setToast({ msg: "Published — your changes are live." });
    } catch {
      setToast({ msg: "Publishing failed. Please try again." });
    } finally {
      setPublishing(false);
    }
  };

  const unpublished = useMemo(() => JSON.stringify(page) !== publishedJson, [page, publishedJson]);

  // ---------------------------------------------------------------------
  // Selection & sections
  // ---------------------------------------------------------------------
  const select = useCallback((section?: string, path?: string) => {
    setSel({ section, path });
    if (section) setLeftTab("sections");
  }, []);

  useEffect(() => {
    if (!sel.section) return;
    document.querySelector(`[data-sec-row="${sel.section}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel.section]);

  const scrollToSection = (id: string) =>
    requestAnimationFrame(() => document.querySelector(`.ed-frame [data-sec-id="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));

  const addSection = (type: SectionType) => {
    const s = createSection(type);
    mutate((d) => {
      const footerIdx = d.sections.findIndex((x) => x.type === "footer");
      const selIdx = sel.section ? d.sections.findIndex((x) => x.id === sel.section) : -1;
      let at = selIdx >= 0 ? selIdx + 1 : footerIdx >= 0 ? footerIdx : d.sections.length;
      if (footerIdx >= 0 && at > footerIdx) at = footerIdx;
      if (d.sections[0]?.type === "header" && at === 0) at = 1;
      d.sections.splice(at, 0, s);
    });
    setLibrary(false);
    select(s.id);
    scrollToSection(s.id);
  };

  const duplicate = (id: string) => {
    const newId = `${id.split("-")[0]}-${uid()}`;
    mutate((d) => {
      const i = d.sections.findIndex((x) => x.id === id);
      if (i < 0) return;
      const copy = structuredClone(d.sections[i]);
      copy.id = newId;
      copy.name = `${copy.name || SECTION_DEFS[copy.type].label} (copy)`;
      d.sections.splice(i + 1, 0, copy);
    });
    select(newId);
    scrollToSection(newId);
  };

  const remove = (id: string) => {
    mutate((d) => {
      d.sections = d.sections.filter((x) => x.id !== id);
    });
    select(undefined);
    setToast({ msg: "Section deleted.", undo: true });
  };

  const move = (from: number, to: number) => {
    const secs = pageRef.current.sections;
    if (to < 0 || to >= secs.length || from === to) return;
    if (SECTION_DEFS[secs[from].type].singleton) return;
    // Keep header first and footer last.
    if (secs[to].type === "header" || secs[to].type === "footer") return;
    mutate((d) => {
      const [s] = d.sections.splice(from, 1);
      d.sections.splice(to, 0, s);
    });
  };

  // ---------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement;
      const inField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        saveNow();
        return;
      }
      if (inField) return;
      if (k === "z" && !e.shiftKey && !target.isContentEditable) {
        e.preventDefault();
        undo();
      } else if (((k === "z" && e.shiftKey) || k === "y") && !target.isContentEditable) {
        e.preventDefault();
        redo();
      } else if ((k === "b" || k === "i" || k === "u") && sel.section && sel.path) {
        e.preventDefault();
        const s = pageRef.current.sections.find((x) => x.id === sel.section);
        const info = s && readPath(s, sel.path);
        if (!info) return;
        // Commit any inline typing first so it isn't lost.
        if (target.isContentEditable && target.innerText !== info.text) {
          const txt = target.innerText;
          updateSection(sel.section, (sec) => writeText(sec, sel.path!, txt));
        }
        const patch =
          k === "b" ? { weight: (info.style.weight ?? 0) >= 700 ? null : 700 } : k === "i" ? { italic: !info.style.italic } : { underline: !info.style.underline };
        updateSection(sel.section, (sec) => writeStyle(sec, sel.path!, patch));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveNow, sel, updateSection]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  const bridge: EditorBridge = {
    selectedSection: sel.section,
    selectedPath: sel.path,
    select,
    setText: (id, path, text) => updateSection(id, (s) => writeText(s, path, text)),
  };
  const api: InspectorApi = { page, updateSection, updateTheme, select, duplicate, remove };
  const selectedSection = page.sections.find((s) => s.id === sel.section);
  const width = DEVICE_WIDTH[device];

  return (
    <div className="studio">
      <header className="st-top">
        <div className="st-brand">
          <span className="st-logo">N</span>
          <div>
            <b>Studio</b>
            <span>{page.title}</span>
          </div>
        </div>

        <div className="st-device" role="radiogroup" aria-label="Preview size">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={device === d} className={cx(device === d && "is-on")} onClick={() => setDevice(d)}>
              {d === "desktop" ? "Desktop" : d === "tablet" ? "Tablet" : "Mobile"}
            </button>
          ))}
        </div>

        <div className="st-top-actions">
          <div className="st-undo">
            <button type="button" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button type="button" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
              ↷
            </button>
          </div>
          <span className={cx("st-status", save === "error" && "is-error")} aria-live="polite">
            {save === "saving" ? "Saving…" : save === "error" ? "Couldn’t save" : dirty ? "Unsaved changes" : unpublished ? "Draft saved · not published" : "Published · up to date"}
          </span>
          <div className="st-menu-wrap">
            <button type="button" className="st-btn" onClick={() => setVersions((v) => !v)} aria-expanded={versions}>
              Versions
            </button>
            {versions && (
              <div className="st-menu">
                <p className="st-menu-title">Last published {fmtTime(publishedAt)}</p>
                {history.length === 0 && <p className="st-hint">Earlier versions appear here after you publish.</p>}
                {history.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      commit(structuredClone(h.page));
                      setVersions(false);
                      setToast({ msg: `Restored version from ${fmtTime(h.at)} into the draft. Publish to make it live.`, undo: true });
                    }}
                  >
                    Restore version from {fmtTime(h.at)}
                  </button>
                ))}
                {unpublished && (
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      commit(JSON.parse(publishedJson));
                      setVersions(false);
                      setToast({ msg: "Draft reset to the live version.", undo: true });
                    }}
                  >
                    Discard draft changes
                  </button>
                )}
              </div>
            )}
          </div>
          <a className="st-btn" href="/?preview=draft" target="_blank" rel="noreferrer" onClick={() => dirty && saveNow()}>
            Preview
          </a>
          <button type="button" className="st-btn st-btn-primary" onClick={publish} disabled={publishing || (!unpublished && !dirty)}>
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      <aside className="st-left">
        <div className="st-tabs" role="tablist">
          <button role="tab" type="button" aria-selected={leftTab === "sections"} className={cx(leftTab === "sections" && "is-on")} onClick={() => setLeftTab("sections")}>
            Sections
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={leftTab === "theme"}
            className={cx(leftTab === "theme" && "is-on")}
            onClick={() => {
              setLeftTab("theme");
              setSel({});
            }}
          >
            Site style
          </button>
        </div>
        {leftTab === "sections" ? (
          <>
            <ol className="st-sections">
              {page.sections.map((s, i) => {
                const def = SECTION_DEFS[s.type];
                const fixed = !!def.singleton;
                return (
                  <li
                    key={s.id}
                    data-sec-row={s.id}
                    className={cx("st-row", sel.section === s.id && "is-on", s.hidden && "is-hidden", dropTarget === i && "is-drop")}
                    draggable={!fixed}
                    onDragStart={(e) => {
                      dragIndex.current = i;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (dragIndex.current === null || fixed) return;
                      e.preventDefault();
                      setDropTarget(i);
                    }}
                    onDragLeave={() => setDropTarget((t) => (t === i ? null : t))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex.current !== null) move(dragIndex.current, i);
                      dragIndex.current = null;
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      dragIndex.current = null;
                      setDropTarget(null);
                    }}
                  >
                    <button
                      type="button"
                      className="st-row-main"
                      onClick={() => {
                        select(s.id);
                        scrollToSection(s.id);
                      }}
                    >
                      <span className="st-grip" aria-hidden="true">
                        {fixed ? "•" : "⋮⋮"}
                      </span>
                      <span className="st-row-name">{s.name || def.label}</span>
                    </button>
                    <div className="st-row-actions">
                      {!fixed && (
                        <>
                          <button type="button" title="Move up" aria-label={`Move ${s.name || def.label} up`} onClick={() => move(i, i - 1)}>
                            ↑
                          </button>
                          <button type="button" title="Move down" aria-label={`Move ${s.name || def.label} down`} onClick={() => move(i, i + 1)}>
                            ↓
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        title={s.hidden ? "Show section" : "Hide section"}
                        aria-label={s.hidden ? "Show section" : "Hide section"}
                        onClick={() => updateSection(s.id, (x) => (x.hidden = !x.hidden))}
                      >
                        {s.hidden ? "◌" : "◉"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="st-add">
              <button type="button" className="st-btn st-btn-block" onClick={() => setLibrary((l) => !l)} aria-expanded={library}>
                + Add section
              </button>
              {library && (
                <div className="st-library">
                  {(Object.values(SECTION_DEFS) as (typeof SECTION_DEFS)[SectionType][])
                    .filter((d) => !d.singleton)
                    .map((d) => (
                      <button key={d.type} type="button" onClick={() => addSection(d.type)}>
                        <b>{d.label}</b>
                        <span>{d.description}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <ThemeInspector api={api} />
        )}
        <footer className="st-left-foot">
          <Link href="/" target="_blank">
            View live site ↗
          </Link>
          <button
            type="button"
            className="link-btn"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
          >
            Log out
          </button>
        </footer>
      </aside>

      <main
        className="st-canvas"
        onClick={() => select(undefined)}
        onClickCapture={(e) => {
          // Never navigate away while editing.
          if ((e.target as HTMLElement).closest("a")) e.preventDefault();
        }}
      >
        {defaultPassword && (
          <p className="st-warning">
            You’re using the default admin password. Set <code>ADMIN_PASSWORD</code> before going live.
          </p>
        )}
        <div className={cx("ed-frame", `is-${device}`)} style={width ? { width } : undefined}>
          <PageRenderer page={page} ctx={{ ...ctx, editor: bridge }} />
        </div>
      </main>

      <aside className="st-right" aria-label="Inspector">
        {selectedSection && sel.path ? (
          <TextInspector key={`${sel.section}:${sel.path}`} api={api} section={selectedSection} path={sel.path} />
        ) : selectedSection ? (
          <SectionInspector key={sel.section} api={api} section={selectedSection} />
        ) : (
          <div className="st-empty">
            <h3>Nothing selected</h3>
            <p>Click any text on the page to edit it and change its heading level, size, weight, decoration and colour.</p>
            <p>Click the empty space in a section to change its background, alignment and spacing.</p>
            <p className="st-hint">Shortcuts: Ctrl+Z undo · Ctrl+Shift+Z redo · Ctrl+B / I / U on selected text · Ctrl+S save</p>
          </div>
        )}
      </aside>

      {toast && (
        <div className="st-toast" role="status">
          {toast.msg}
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                undo();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

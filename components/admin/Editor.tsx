"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorBridge, PageRenderer, RenderCtx, readEditable } from "@/components/cms/PageRenderer";
import { Page, SECTION_DEFS, STUDIO_FONTS_HREF, Section, SectionType, Theme, createSection, uid } from "@/lib/cms/schema";
import { cx } from "@/lib/format";
import { StudioNav, logout } from "./StudioNav";
import { InspectorApi, SectionInspector, TextInspector, ThemeInspector, readPath, writeStyle, writeText } from "./Inspector";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };
/** "conflict": another tab saved first; "expired": the admin session ended. Both stop autosave. */
/** "invalid": the server rejected the content (e.g. a half-typed link); fixed by the next edit. */
type SaveState = "idle" | "saving" | "saved" | "error" | "invalid" | "conflict" | "expired";

interface Props {
  initialDraft: Page;
  initialPublished: Page;
  draftRev: number;
  publishedAt: string | null;
  history: { at: string; page: Page }[];
  ctx: Omit<RenderCtx, "editor">;
  newEnquiries?: number;
}

/** Put the caret back at the end of an inline-edited text after React re-rendered it. */
function refocus(sectionId: string, path: string) {
  const el = document.querySelector<HTMLElement>(`.ed-frame [data-ed-sec="${CSS.escape(sectionId)}"][data-ed-path="${CSS.escape(path)}"]`);
  if (!el || el.getAttribute("contenteditable") !== "true") return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");

export function Editor({ initialDraft, initialPublished, draftRev, publishedAt: initialPublishedAt, history: initialHistory, ctx, newEnquiries }: Props) {
  const [page, setPage] = useState<Page>(initialDraft);
  const pageRef = useRef(page);
  const past = useRef<Page[]>([]);
  const future = useRef<Page[]>([]);
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  // Undo/redo availability lives in state so the buttons re-render correctly (refs are not render data).
  // `seq` counts every change (edit, undo, redo) so a toast can tell whether anything happened since.
  const seq = useRef(0);
  const [hist, setHist] = useState({ past: 0, future: 0, seq: 0 });
  const router = useRouter();
  const syncHist = () => setHist({ past: past.current.length, future: future.current.length, seq: ++seq.current });

  const [publishedJson, setPublishedJson] = useState(() => JSON.stringify(initialPublished));
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [history, setHistory] = useState(initialHistory);
  const [save, setSave] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  // What the server holds: the draft revision it last confirmed, and that draft's JSON.
  const revRef = useRef(draftRev);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialDraft));
  const pageJson = useMemo(() => JSON.stringify(page), [page]);
  const dirty = pageJson !== savedJson;
  const blocked = save === "conflict" || save === "expired";

  const [sel, setSel] = useState<{ section?: string; path?: string }>({});
  const [leftTab, setLeftTab] = useState<"sections" | "theme">("sections");
  // Narrow screens show one panel at a time (tablets keep the page beside the side panel).
  const [panel, setPanel] = useState<"sections" | "page" | "style">("page");
  const onPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const [device, setDevice] = useState<Device>("desktop");
  const [library, setLibrary] = useState(false);
  const [versions, setVersions] = useState(false);
  // `undoAt`: the change counter right after the action. Undo is only offered while nothing else has happened since.
  const [toast, setToast] = useState<{ msg: string; undoAt?: number } | null>(null);
  const [toastHeld, setToastHeld] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  // ---------------------------------------------------------------------
  // History-aware mutation
  // ---------------------------------------------------------------------
  const commit = useCallback((next: Page, key?: string) => {
    if (next === pageRef.current || JSON.stringify(next) === JSON.stringify(pageRef.current)) return; // nothing changed: no undo step
    const now = Date.now();
    const coalesce = key && lastKey.current?.key === key && now - lastKey.current.t < 1200;
    if (!coalesce) {
      past.current.push(pageRef.current);
      if (past.current.length > 150) past.current.shift();
    }
    future.current = [];
    syncHist();
    lastKey.current = key ? { key, t: now } : null;
    pageRef.current = next;
    setPage(next);
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
    syncHist();
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(pageRef.current);
    pageRef.current = next;
    lastKey.current = null;
    setPage(next);
    syncHist();
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
  // Saves and publishes run one at a time, in order, each sending the revision the previous one
  // returned. Without the queue a slow save could land after a newer one and be reported as a conflict.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const savedRef = useRef(savedJson);
  const rejectedJson = useRef<string | null>(null);
  // Why saving is paused: a conflict needs a reload; an ended session resumes on the next manual save.
  const blockedRef = useRef<null | "conflict" | "expired">(null);
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(job);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  /** Handle a non-OK response shared by save and publish. Returns the message to show. */
  const failed = useCallback(async (res: Response, what: string) => {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 401) {
      blockedRef.current = "expired";
      setSave("expired");
      return "Your session has ended. Log in again in a new tab, then press Ctrl+S here — nothing is lost.";
    }
    if (res.status === 409) {
      blockedRef.current = "conflict";
      setSave("conflict");
      return body?.error ?? "This page was changed in another tab. Reload to get the latest version.";
    }
    if (res.status === 400 && body?.error) {
      if (what === "save") setSave("invalid");
      return body.error.replace(/\s*\(at [^)]*\)$/, "");
    }
    if (what === "save") setSave("error");
    return body?.error ?? `Couldn’t ${what}. Please try again.`;
  }, []);

  const markSaved = (json: string, rev: number) => {
    revRef.current = rev;
    savedRef.current = json;
    setSavedJson(json);
  };

  const saveNow = useCallback(
    (manual = false) =>
      enqueue(async () => {
        const snapshot = pageRef.current;
        const json = JSON.stringify(snapshot);
        if (json === savedRef.current) return true;
        if (manual && blockedRef.current === "expired") blockedRef.current = null; // maybe logged in again in another tab
        if (blockedRef.current) return false;
        setSave("saving");
        rejectedJson.current = json;
        try {
          const res = await fetch("/api/cms", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: snapshot, rev: revRef.current }) });
          if (!res.ok) {
            setSaveError(await failed(res, "save"));
            return false;
          }
          const data = (await res.json()) as { draftRev: number };
          markSaved(json, data.draftRev);
          setSaveError(null);
          setSave("saved");
          return true;
        } catch {
          setSave("error");
          setSaveError("Couldn’t save. Check your connection — we’ll keep trying.");
          return false;
        }
      }),
    [enqueue, failed]
  );

  /** Ctrl+S, Preview, leaving: first commit text still being typed inline, then save. */
  const flushAndSave = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el?.isContentEditable && el.dataset.edPath) {
      el.blur(); // the editable commits on blur
      requestAnimationFrame(() => refocus(el.dataset.edSec!, el.dataset.edPath!));
    }
    return saveNow(true);
  }, [saveNow]);

  // Autosave shortly after typing stops; retry failed saves every few seconds.
  useEffect(() => {
    if (!dirty || blocked) return;
    if (save === "invalid" && rejectedJson.current === pageJson) return; // wait for the next edit
    const t = setTimeout(() => saveNow(), save === "error" ? 5000 : 1200);
    return () => clearTimeout(t);
  }, [pageJson, dirty, blocked, save, saveNow]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Last resort when the editor unmounts some other way (browser Back): send the unsaved draft with
  // keepalive so the request outlives the page. Browsers cap keepalive bodies at 64 KB.
  useEffect(
    () => () => {
      const json = JSON.stringify(pageRef.current);
      if (json === savedRef.current || blockedRef.current) return;
      const body = JSON.stringify({ page: pageRef.current, rev: revRef.current });
      if (body.length < 60_000) fetch("/api/cms", { method: "PUT", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    },
    []
  );

  /** Studio links (Listings, Enquiries, Log out) save first, and ask before leaving unsaved work. */
  const leave = useCallback(
    async (go: () => void) => {
      if (savedRef.current !== JSON.stringify(pageRef.current) && !(await flushAndSave()) && !window.confirm("Your latest changes couldn’t be saved. Leave anyway and lose them?")) return;
      go();
    },
    [flushAndSave]
  );

  const publish = () =>
    enqueue(async () => {
      if (blockedRef.current === "expired") blockedRef.current = null;
      if (blockedRef.current) return;
      setPublishing(true);
      const snapshot = pageRef.current;
      const json = JSON.stringify(snapshot);
      try {
        const res = await fetch("/api/cms/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: snapshot, rev: revRef.current }) });
        if (!res.ok) {
          setToast({ msg: await failed(res, "publish") });
          return;
        }
        const data = (await res.json()) as { publishedAt: string; draftRev: number };
        markSaved(json, data.draftRev);
        setPublishedJson(json);
        setPublishedAt(data.publishedAt);
        setSave("saved");
        setSaveError(null);
        setToast({ msg: "Published — your changes are live." });
      } catch {
        setToast({ msg: "Publishing failed — check your connection and try again." });
        return;
      } finally {
        setPublishing(false);
      }
      // The version list is a nicety: if refreshing it fails, publishing still succeeded.
      try {
        const res = await fetch("/api/cms", { cache: "no-store" });
        if (res.ok) setHistory(((await res.json()) as { history: typeof history }).history);
      } catch {
        /* keep the old list */
      }
    });

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
    if (onPhone()) setPanel("page");
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

  /** Run a change and confirm it in a toast, offering Undo only if the change actually happened. */
  const undoable = (msg: string, change: () => void) => {
    const before = seq.current;
    change();
    setToast({ msg, undoAt: seq.current !== before ? seq.current : undefined });
  };

  const remove = (id: string) => {
    undoable("Section deleted.", () =>
      mutate((d) => {
        d.sections = d.sections.filter((x) => x.id !== id);
      })
    );
    select(undefined);
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
        flushAndSave();
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
        const secId = sel.section;
        const path = sel.path;
        const s = pageRef.current.sections.find((x) => x.id === secId);
        const info = s && readPath(s, path);
        if (!info) return;
        // Typing still in progress and the style change land as one step, so one undo reverts both.
        const typed = target.isContentEditable && target.dataset.edTyped === "1" ? readEditable(target) : null;
        if (typed !== null) delete target.dataset.edTyped;
        const patch =
          k === "b" ? { weight: (info.style.weight ?? 0) >= 700 ? null : 700 } : k === "i" ? { italic: !info.style.italic } : { underline: !info.style.underline };
        updateSection(secId, (sec) => {
          if (typed !== null && typed !== info.text) writeText(sec, path, typed);
          writeStyle(sec, path, patch);
        });
        if (target.isContentEditable) requestAnimationFrame(() => refocus(secId, path));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, flushAndSave, sel, updateSection]);

  useEffect(() => {
    if (!toast || toastHeld) return;
    const t = setTimeout(() => setToast(null), toast.undoAt !== undefined ? 8000 : 4500);
    return () => clearTimeout(t);
  }, [toast, toastHeld]);

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
    <div className="studio" data-panel={panel}>
      <header className="st-top">
        <link rel="stylesheet" href={STUDIO_FONTS_HREF} precedence="default" />
        <div className="st-brand">
          <b>Nivaas Studio</b>
        </div>
        <div
          className="st-nav-wrap"
          onClickCapture={(e) => {
            // Leaving the editor inside the app: save first instead of dropping the last edits.
            const a = (e.target as HTMLElement).closest("a");
            const href = a?.getAttribute("href");
            if (!href || href === "/admin" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            leave(() => router.push(href));
          }}
        >
          <StudioNav active="page" newEnquiries={newEnquiries} />
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
            <button type="button" onClick={undo} disabled={!hist.past} title="Undo (Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button type="button" onClick={redo} disabled={!hist.future} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
              ↷
            </button>
          </div>
          <span className={cx("st-status", (save === "error" || save === "invalid" || blocked) && "is-error")} aria-live="polite" title={saveError ?? undefined}>
            {save === "conflict" ? (
              <>
                Changed in another tab ·{" "}
                <button type="button" className="text-link" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </>
            ) : save === "expired" ? (
              <>
                Session ended ·{" "}
                <a className="text-link" href="/admin/login" target="_blank" rel="noreferrer">
                  Log in again ↗
                </a>
              </>
            ) : save === "saving" ? (
              "Saving…"
            ) : save === "error" ? (
              "Couldn’t save · retrying"
            ) : save === "invalid" ? (
              `Not saved: ${saveError ?? "check the last change"}`
            ) : dirty ? (
              "Unsaved changes"
            ) : unpublished ? (
              "Draft saved · not published"
            ) : (
              "Published · up to date"
            )}
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
                      setVersions(false);
                      undoable(`Restored the version from ${fmtTime(h.at)} into the draft. Publish to make it live.`, () => commit(structuredClone(h.page)));
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
                      setVersions(false);
                      undoable("Draft reset to the live version.", () => commit(JSON.parse(publishedJson)));
                    }}
                  >
                    Discard draft changes
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="st-btn"
            onClick={() => {
              // Open the tab synchronously (popup blockers), then load it once the draft is saved.
              const tab = window.open("about:blank", "_blank");
              flushAndSave().then((ok) => {
                if (!tab) return;
                if (ok) tab.location.href = "/?preview=draft";
                else tab.close();
                if (!ok) setToast({ msg: "Save the draft before previewing — it couldn’t be saved just now." });
              });
            }}
          >
            Preview
          </button>
          <button type="button" className="st-btn st-btn-primary" onClick={publish} disabled={publishing || save === "conflict" || (!unpublished && !dirty)}>
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      <aside className="st-left">
        <div className="st-tabs" role="group" aria-label="Left panel">
          <button type="button" aria-pressed={leftTab === "sections"} className={cx(leftTab === "sections" && "is-on")} onClick={() => setLeftTab("sections")}>
            Sections
          </button>
          <button
            type="button"
            aria-pressed={leftTab === "theme"}
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
                        if (onPhone()) setPanel("page");
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
                        aria-label={`${s.hidden ? "Show" : "Hide"} ${s.name || def.label}`}
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
            Open live site ↗
          </Link>
          <button
            type="button"
            className="text-link"
            onClick={() => leave(() => logout(router))}
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

      <nav className="st-panelbar" aria-label="Editor panels">
        <button type="button" aria-pressed={panel === "sections"} onClick={() => setPanel("sections")}>
          Sections
        </button>
        <button type="button" aria-pressed={panel === "page"} onClick={() => setPanel("page")}>
          Page
        </button>
        <button type="button" aria-pressed={panel === "style"} onClick={() => setPanel("style")}>
          Style
          {selectedSection && (
            <>
              {" "}
              <span aria-hidden="true">●</span>
              <span className="sr-only">, item selected</span>
            </>
          )}
        </button>
      </nav>

      {toast && (
        <div
          className="st-toast"
          role="status"
          onMouseEnter={() => setToastHeld(true)}
          onMouseLeave={() => setToastHeld(false)}
          onFocus={() => setToastHeld(true)}
          onBlur={() => setToastHeld(false)}
        >
          {toast.msg}
          {toast.undoAt !== undefined && toast.undoAt === hist.seq && hist.past > 0 && (
            <button
              type="button"
              onClick={() => {
                undo();
                setToast(null);
                setToastHeld(false);
              }}
            >
              Undo
            </button>
          )}
          <button type="button" className="st-toast-close" aria-label="Dismiss" onClick={() => (setToast(null), setToastHeld(false))}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

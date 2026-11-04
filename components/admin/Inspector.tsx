"use client";

import { FONT_OPTIONS, Page, SECTION_DEFS, Section, SectionStyle, TAGS, Tag, TextStyle, Theme, defaultSizeFor } from "@/lib/cms/schema";
import { cx } from "@/lib/format";
import { ColorInput, Field, Group, Input, Segmented, Select, Slider, Switch, TextArea, ToggleButton } from "./controls";

export interface InspectorApi {
  page: Page;
  updateSection: (id: string, fn: (s: Section) => void, coalesceKey?: string) => void;
  updateTheme: (fn: (t: Theme, p: Page) => void, coalesceKey?: string) => void;
  select: (sectionId?: string, path?: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Path helpers: "t:<role>" for section text, "i:<index>:<field>" for list items
// ---------------------------------------------------------------------------

export function readPath(s: Section, path: string): { text: string; style: TextStyle; label: string; shared?: string } | null {
  const def = SECTION_DEFS[s.type];
  if (path.startsWith("t:")) {
    const role = path.slice(2);
    const b = s.text[role];
    if (!b) return null;
    return { text: b.text, style: b.style, label: def.textRoles.find((r) => r.key === role)?.label ?? role };
  }
  const [, idxS, field] = path.split(":");
  const idx = Number(idxS);
  const item = s.items?.[idx];
  if (!item) return null;
  const f = def.itemFields?.find((x) => x.key === field);
  return {
    text: item[field] ?? "",
    style: s.itemStyles?.[field] ?? { tag: "span" },
    label: `${def.itemLabel ?? "Item"} ${idx + 1} · ${f?.label ?? field}`,
    shared: `${f?.label ?? field} style is shared by every ${(def.itemLabel ?? "item").toLowerCase()} in this section.`,
  };
}

export function writeText(s: Section, path: string, text: string) {
  if (path.startsWith("t:")) {
    const b = s.text[path.slice(2)];
    if (b) b.text = text;
    return;
  }
  const [, idxS, field] = path.split(":");
  const item = s.items?.[Number(idxS)];
  if (item) item[field] = text;
}

export function writeStyle(s: Section, path: string, patch: Partial<TextStyle>) {
  if (path.startsWith("t:")) {
    const b = s.text[path.slice(2)];
    if (b) b.style = { ...b.style, ...patch };
    return;
  }
  const field = path.split(":")[2];
  s.itemStyles = { ...(s.itemStyles ?? {}), [field]: { ...(s.itemStyles?.[field] ?? { tag: "span" }), ...patch } };
}

// ---------------------------------------------------------------------------
// Text inspector — content + typography
// ---------------------------------------------------------------------------

const TAG_LABEL: Record<Tag, string> = { h1: "H1", h2: "H2", h3: "H3", h4: "H4", h5: "H5", h6: "H6", p: "P", span: "Text" };

export function TextInspector({ api, section, path }: { api: InspectorApi; section: Section; path: string }) {
  const info = readPath(section, path);
  if (!info) return <p className="st-empty">This element no longer exists.</p>;
  const st = info.style;
  const set = (patch: Partial<TextStyle>, key?: string) => api.updateSection(section.id, (s) => writeStyle(s, path, patch), key ? `${section.id}:${path}:${key}` : undefined);
  const def = SECTION_DEFS[section.type];
  const multiline = path.startsWith("t:") ? def.textRoles.find((r) => `t:${r.key}` === path)?.multiline : def.itemFields?.find((f) => f.key === path.split(":")[2])?.multiline;

  return (
    <div className="st-inspector">
      <nav className="st-crumb">
        <button type="button" onClick={() => api.select(section.id)}>
          {section.name || def.label}
        </button>
        <span>›</span>
        <b>{info.label}</b>
      </nav>

      <Group title="Content">
        {multiline ? (
          <TextArea
            aria-label={`${info.label} — text`}
            rows={4}
            value={info.text}
            onChange={(e) => api.updateSection(section.id, (s) => writeText(s, path, e.target.value), `${section.id}:${path}:text`)}
          />
        ) : (
          <Input
            aria-label={`${info.label} — text`}
            value={info.text}
            onChange={(e) => api.updateSection(section.id, (s) => writeText(s, path, e.target.value), `${section.id}:${path}:text`)}
          />
        )}
        <p className="st-hint">Tip: you can also click the text on the page and type directly.</p>
      </Group>

      <Group title="Typography">
        {info.shared && <p className="st-note">{info.shared}</p>}
        <Field label="Element">
          <Segmented<Tag> ariaLabel="HTML element" value={st.tag} options={TAGS.map((t) => ({ value: t, label: TAG_LABEL[t], title: t === "span" ? "Inline text" : t === "p" ? "Paragraph" : `Heading ${t[1]}` }))} onChange={(tag) => set({ tag })} small />
        </Field>
        <Field label="Style">
          <div className="st-tbtns">
            <ToggleButton title="Bold (Ctrl+B)" on={(st.weight ?? 0) >= 700} onClick={() => set({ weight: (st.weight ?? 0) >= 700 ? null : 700 })}>
              <b>B</b>
            </ToggleButton>
            <ToggleButton title="Italic (Ctrl+I)" on={!!st.italic} onClick={() => set({ italic: !st.italic })}>
              <i>I</i>
            </ToggleButton>
            <ToggleButton title="Underline (Ctrl+U)" on={!!st.underline} onClick={() => set({ underline: !st.underline })}>
              <u>U</u>
            </ToggleButton>
            <ToggleButton title="Overline" on={!!st.overline} onClick={() => set({ overline: !st.overline })}>
              <span style={{ textDecoration: "overline" }}>O</span>
            </ToggleButton>
            <ToggleButton title="Strikethrough" on={!!st.strike} onClick={() => set({ strike: !st.strike })}>
              <s>S</s>
            </ToggleButton>
          </div>
        </Field>
        <Field label="Font size">
          <Slider value={st.fontSize} placeholder={defaultSizeFor(st.tag)} min={10} max={120} unit="px" onChange={(v) => set({ fontSize: v }, "size")} onReset={() => set({ fontSize: null })} />
        </Field>
        <Field label="Weight">
          <Select value={st.weight ?? ""} onChange={(e) => set({ weight: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Auto</option>
            {[300, 400, 500, 600, 700, 800].map((w) => (
              <option key={w} value={w}>
                {w} {w === 400 ? "· Regular" : w === 700 ? "· Bold" : w === 300 ? "· Light" : w === 600 ? "· Semibold" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Typeface">
          <Segmented<"auto" | "display" | "body">
            value={st.font ?? "auto"}
            options={[
              { value: "auto", label: "Auto" },
              { value: "display", label: "Display" },
              { value: "body", label: "Body" },
            ]}
            onChange={(v) => set({ font: v === "auto" ? null : v })}
            small
          />
        </Field>
        <Field label="Colour">
          <ColorInput value={st.color} onChange={(color) => set({ color }, "color")} onReset={() => set({ color: null })} placeholder="Inherit" />
        </Field>
        <Field label="Alignment">
          <Segmented<"inherit" | "left" | "center" | "right">
            value={st.align ?? "inherit"}
            options={[
              { value: "inherit", label: "Section" },
              { value: "left", label: "Left" },
              { value: "center", label: "Centre" },
              { value: "right", label: "Right" },
            ]}
            onChange={(v) => set({ align: v === "inherit" ? null : v })}
            small
          />
        </Field>
        <Field label="Line height">
          <Slider value={st.lineHeight} placeholder={1.3} min={0.8} max={2.4} step={0.05} onChange={(v) => set({ lineHeight: v }, "lh")} onReset={() => set({ lineHeight: null })} />
        </Field>
        <Field label="Letter spacing">
          <Slider value={st.letterSpacing} placeholder={0} min={-0.05} max={0.4} step={0.01} unit="em" onChange={(v) => set({ letterSpacing: v }, "ls")} onReset={() => set({ letterSpacing: null })} />
        </Field>
        <Field label="Case">
          <Segmented<NonNullable<TextStyle["transform"]>>
            value={st.transform ?? "none"}
            options={[
              { value: "none", label: "Aa" },
              { value: "uppercase", label: "AA" },
              { value: "lowercase", label: "aa" },
              { value: "capitalize", label: "Ab" },
            ]}
            onChange={(transform) => set({ transform })}
            small
          />
        </Field>
        <button
          type="button"
          className="st-btn st-btn-ghost"
          onClick={() => set({ fontSize: null, weight: null, italic: false, underline: false, overline: false, strike: false, color: null, align: null, letterSpacing: null, lineHeight: null, transform: "none", font: null })}
        >
          Clear formatting
        </button>
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section inspector — settings, list items and section styling
// ---------------------------------------------------------------------------

export function SectionInspector({ api, section }: { api: InspectorApi; section: Section }) {
  const def = SECTION_DEFS[section.type];
  const up = (fn: (s: Section) => void, key?: string) => api.updateSection(section.id, fn, key ? `${section.id}:${key}` : undefined);
  const st = section.style;
  const setStyle = (patch: Partial<SectionStyle>, key?: string) => up((s) => (s.style = { ...s.style, ...patch }), key ? `style:${key}` : undefined);

  return (
    <div className="st-inspector">
      <div className="st-title-row">
        <input className="st-input st-name" value={section.name ?? ""} placeholder={def.label} onChange={(e) => up((s) => (s.name = e.target.value || undefined), "name")} aria-label="Section name" />
        <span className="st-type">{def.label}</span>
      </div>
      <Switch checked={!section.hidden} onChange={(v) => up((s) => (s.hidden = !v))} label="Visible on the website" />

      {def.textRoles.length > 0 && (
        <Group title="Text">
          {def.textRoles.map((r) => (
            <Field key={r.key} label={r.label}>
              <div className="st-with-action">
                {r.multiline ? (
                  <TextArea rows={3} value={section.text[r.key]?.text ?? ""} onChange={(e) => up((s) => writeText(s, `t:${r.key}`, e.target.value), `t:${r.key}`)} />
                ) : (
                  <Input value={section.text[r.key]?.text ?? ""} onChange={(e) => up((s) => writeText(s, `t:${r.key}`, e.target.value), `t:${r.key}`)} />
                )}
                <button type="button" className="st-icon-btn" title={`Typography for ${r.label}`} onClick={() => api.select(section.id, `t:${r.key}`)}>
                  Aa
                </button>
              </div>
            </Field>
          ))}
        </Group>
      )}

      {def.itemFields && (
        <Group
          title={`${def.itemLabel ?? "Item"}s`}
          actions={
            <button
              type="button"
              className="st-btn st-btn-small"
              onClick={() =>
                up((s) => {
                  const blank = Object.fromEntries(def.itemFields!.map((f) => [f.key, f.options?.[0]?.value ?? (f.meta ? "#" : `New ${f.label.toLowerCase()}`)]));
                  s.items = [...(s.items ?? []), blank];
                })
              }
            >
              + Add
            </button>
          }
        >
          <ol className="st-items">
            {(section.items ?? []).map((item, i) => (
              <li key={i} className="st-item">
                <div className="st-item-head">
                  <span>
                    {def.itemLabel} {i + 1}
                  </span>
                  <div>
                    <button type="button" className="st-icon-btn" disabled={i === 0} title="Move up" onClick={() => up((s) => s.items!.splice(i - 1, 0, s.items!.splice(i, 1)[0]))}>
                      ↑
                    </button>
                    <button type="button" className="st-icon-btn" disabled={i === (section.items?.length ?? 0) - 1} title="Move down" onClick={() => up((s) => s.items!.splice(i + 1, 0, s.items!.splice(i, 1)[0]))}>
                      ↓
                    </button>
                    <button type="button" className="st-icon-btn is-danger" title="Remove" onClick={() => up((s) => s.items!.splice(i, 1))}>
                      ✕
                    </button>
                  </div>
                </div>
                {def.itemFields!.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.options ? (
                      <Select value={item[f.key] ?? ""} onChange={(e) => up((s) => (s.items![i][f.key] = e.target.value))}>
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : f.multiline ? (
                      <TextArea rows={2} value={item[f.key] ?? ""} onChange={(e) => up((s) => (s.items![i][f.key] = e.target.value), `i:${i}:${f.key}`)} />
                    ) : (
                      <Input value={item[f.key] ?? ""} onChange={(e) => up((s) => (s.items![i][f.key] = e.target.value), `i:${i}:${f.key}`)} />
                    )}
                  </Field>
                ))}
              </li>
            ))}
          </ol>
          {(section.items?.length ?? 0) > 0 && (
            <div className="st-chiprow">
              <span className="st-hint">Style:</span>
              {def.itemFields
                .filter((f) => !f.meta)
                .map((f) => (
                  <button key={f.key} type="button" className="st-chip" onClick={() => api.select(section.id, `i:0:${f.key}`)}>
                    Aa {f.label}
                  </button>
                ))}
            </div>
          )}
        </Group>
      )}

      {def.settings.length > 0 && (
        <Group title="Settings">
          {def.settings.map((sd) => {
            const v = section.settings[sd.key];
            if (sd.type === "toggle") return <Switch key={sd.key} checked={!!v} onChange={(nv) => up((s) => (s.settings[sd.key] = nv))} label={sd.label} />;
            return (
              <Field key={sd.key} label={sd.label} hint={sd.hint}>
                {sd.type === "select" ? (
                  <Select value={String(v ?? "")} onChange={(e) => up((s) => (s.settings[sd.key] = e.target.value))}>
                    {sd.options!.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : sd.type === "number" ? (
                  <Slider value={Number(v) || 0} min={sd.min ?? 0} max={sd.max ?? 100} onChange={(nv) => up((s) => (s.settings[sd.key] = nv), `set:${sd.key}`)} />
                ) : (
                  <Input value={String(v ?? "")} onChange={(e) => up((s) => (s.settings[sd.key] = e.target.value), `set:${sd.key}`)} />
                )}
              </Field>
            );
          })}
        </Group>
      )}

      <Group title="Section style">
        <Field label="Background">
          <Segmented<SectionStyle["bgType"]>
            value={st.bgType}
            options={[
              { value: "none", label: "None" },
              { value: "color", label: "Colour" },
              { value: "gradient", label: "Gradient" },
              { value: "image", label: "Image" },
            ]}
            onChange={(bgType) => setStyle((bgType === "gradient" || bgType === "image") && !st.textColor ? { bgType, textColor: "#f5f3ee" } : { bgType })}
            small
          />
        </Field>
        {st.bgType === "color" && (
          <Field label="Background colour">
            <ColorInput value={st.bgColor} onChange={(bgColor) => setStyle({ bgColor }, "bg")} />
          </Field>
        )}
        {st.bgType === "gradient" && (
          <>
            <Field label="From">
              <ColorInput value={st.gradFrom} onChange={(gradFrom) => setStyle({ gradFrom }, "gf")} />
            </Field>
            <Field label="To">
              <ColorInput value={st.gradTo} onChange={(gradTo) => setStyle({ gradTo }, "gt")} />
            </Field>
            <Field label="Angle">
              <Slider value={st.gradAngle} min={0} max={360} unit="°" onChange={(gradAngle) => setStyle({ gradAngle }, "ga")} />
            </Field>
          </>
        )}
        {st.bgType === "image" && (
          <>
            <Field label="Image URL" hint="Paste a link to a photo (https://…). Upload support can be added with a storage bucket.">
              <Input value={st.bgImage} placeholder="https://…" onChange={(e) => setStyle({ bgImage: e.target.value }, "img")} />
            </Field>
            <Field label="Darken image">
              <Slider value={Math.round(st.overlay * 100)} min={0} max={90} unit="%" onChange={(v) => setStyle({ overlay: v / 100 }, "ov")} />
            </Field>
          </>
        )}
        <Field label="Text colour">
          <ColorInput value={st.textColor} onChange={(textColor) => setStyle({ textColor }, "tc")} onReset={() => setStyle({ textColor: null })} placeholder="Theme" />
        </Field>
        <Field label="Alignment">
          <Segmented<SectionStyle["align"]>
            value={st.align}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Centre" },
              { value: "right", label: "Right" },
            ]}
            onChange={(align) => setStyle({ align })}
            small
          />
        </Field>
        <Field label="Content width">
          <Segmented<SectionStyle["width"]>
            value={st.width}
            options={[
              { value: "narrow", label: "Narrow" },
              { value: "normal", label: "Normal" },
              { value: "wide", label: "Wide" },
              { value: "full", label: "Full" },
            ]}
            onChange={(width) => setStyle({ width })}
            small
          />
        </Field>
        <Field label="Vertical spacing">
          <Slider value={st.paddingY} min={0} max={200} step={4} unit="px" onChange={(paddingY) => setStyle({ paddingY }, "py")} />
        </Field>
        <Field label="Corner radius" hint="Applies to cards and boxes inside this section.">
          <Slider value={st.radius} min={0} max={40} unit="px" onChange={(radius) => setStyle({ radius }, "r")} />
        </Field>
      </Group>

      {!def.singleton && (
        <div className="st-actions">
          <button type="button" className="st-btn" onClick={() => api.duplicate(section.id)}>
            Duplicate section
          </button>
          <button type="button" className="st-btn st-btn-danger" onClick={() => api.remove(section.id)}>
            Delete section
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme inspector — site-wide colours and fonts
// ---------------------------------------------------------------------------

const THEME_COLORS: [keyof Theme, string][] = [
  ["primary", "Primary"],
  ["accent", "Accent"],
  ["background", "Page background"],
  ["surface", "Cards"],
  ["ink", "Text"],
  ["muted", "Secondary text"],
];

const PRESETS: { name: string; theme: Partial<Theme> }[] = [
  { name: "Ink & laterite", theme: { primary: "#1d211e", accent: "#9b3d23", background: "#f5f3ee", surface: "#fcfbf8", ink: "#1d211e", muted: "#66635b" } },
  { name: "Konkan teal", theme: { primary: "#163b3a", accent: "#a4502a", background: "#f3f2ec", surface: "#fbfaf6", ink: "#162523", muted: "#5d6764" } },
  { name: "Deccan ochre", theme: { primary: "#2a2723", accent: "#93661a", background: "#f6f2ea", surface: "#fdfbf6", ink: "#2a2723", muted: "#6c655a" } },
  { name: "Plain white", theme: { primary: "#111111", accent: "#a33a1f", background: "#ffffff", surface: "#ffffff", ink: "#111111", muted: "#5f5f5f" } },
];

export function ThemeInspector({ api }: { api: InspectorApi }) {
  const th = api.page.theme;
  return (
    <div className="st-inspector">
      <Group title="Page">
        <Field label="Page name">
          <Input value={api.page.title} onChange={(e) => api.updateTheme((_, p) => (p.title = e.target.value), "title")} />
        </Field>
      </Group>
      <Group title="Colour presets">
        <div className="st-presets">
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className={cx("st-preset", th.primary === p.theme.primary && "is-on")} onClick={() => api.updateTheme((t) => Object.assign(t, p.theme))}>
              <span className="st-swatches">
                <i style={{ background: p.theme.primary }} />
                <i style={{ background: p.theme.accent }} />
                <i style={{ background: p.theme.background }} />
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Colours">
        {THEME_COLORS.map(([k, label]) => (
          <Field key={k} label={label} inline>
            <ColorInput value={String(th[k])} onChange={(v) => api.updateTheme((t) => ((t[k] as string) = v), `theme:${k}`)} />
          </Field>
        ))}
      </Group>
      <Group title="Fonts">
        <Field label="Display (headings)">
          <Select value={th.fontDisplay} onChange={(e) => api.updateTheme((t) => (t.fontDisplay = e.target.value))}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Body text">
          <Select value={th.fontBody} onChange={(e) => api.updateTheme((t) => (t.fontBody = e.target.value))}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      </Group>
      <Group title="Shape">
        <Field label="Corner radius">
          <Slider value={th.radius} min={0} max={28} unit="px" onChange={(v) => api.updateTheme((t) => (t.radius = v), "theme:radius")} />
        </Field>
      </Group>
    </div>
  );
}

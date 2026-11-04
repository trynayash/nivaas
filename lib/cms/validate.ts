// Strict validation for CMS pages (on every save/publish) and a forgiving normaliser (on every
// read). Together they guarantee the renderer only ever sees well-formed pages: no unknown tags
// (e.g. <script>), no CSS injected through colour/size values, no unsafe link or image URLs.
import { z } from "zod";
import { DEFAULT_THEME, FONT_OPTIONS, SECTION_DEFS, TAGS, baseStyle, defaultPage, type Page, type Section, type SectionType, type TextStyle } from "./schema";

export const MAX_PAGE_BYTES = 512 * 1024;

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Colours must be hex values like #1d211e.");
const font = z.enum(FONT_OPTIONS.map((f) => f.value) as [string, ...string[]]);
const num = (min: number, max: number) => z.number().finite().min(min).max(max);
const SAFE_HREF = /^(\/(?!\/)[^\s"<>]*|#[A-Za-z0-9_-]*|https:\/\/[^\s"<>]+|mailto:[^\s"<>]+|tel:[+0-9() -]+|whatsapp)$/;
const href = z.string().max(500).regex(SAFE_HREF, "Links must start with /, #, https://, mailto: or tel:.");
const imageUrl = z.string().max(1000).regex(/^(|https:\/\/[^\s"'()\\<>]+)$/, "Images must be https:// links.");

const textStyle = z.object({
  tag: z.enum(TAGS as [string, ...string[]]),
  fontSize: num(6, 200).nullable().optional(),
  weight: num(100, 900).nullable().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  overline: z.boolean().optional(),
  strike: z.boolean().optional(),
  color: color.nullable().optional(),
  align: z.enum(["left", "center", "right"]).nullable().optional(),
  letterSpacing: num(-0.2, 1).nullable().optional(),
  lineHeight: num(0.5, 4).nullable().optional(),
  transform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  font: z.enum(["display", "body"]).nullable().optional(),
});

const sectionStyle = z.object({
  bgType: z.enum(["none", "color", "gradient", "image"]),
  bgColor: color,
  gradFrom: color,
  gradTo: color,
  gradAngle: num(0, 360),
  bgImage: imageUrl,
  overlay: num(0, 0.95),
  textColor: color.nullable(),
  align: z.enum(["left", "center", "right"]),
  paddingY: num(0, 400),
  width: z.enum(["narrow", "normal", "wide", "full"]),
  radius: num(0, 80),
});

const HREF_KEYS = new Set(["href", "ctaHref"]);
const settingValue = z.union([z.string().max(500), z.number().finite(), z.boolean()]);

const section = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/),
    type: z.enum(Object.keys(SECTION_DEFS) as [SectionType, ...SectionType[]]),
    name: z.string().max(80).optional(),
    hidden: z.boolean().optional(),
    style: sectionStyle,
    text: z.record(z.string().max(40), z.object({ text: z.string().max(5000), style: textStyle })),
    items: z.array(z.record(z.string().max(40), z.string().max(2000))).max(50).optional(),
    itemStyles: z.record(z.string().max(40), textStyle).optional(),
    settings: z.record(z.string().max(40), settingValue),
  })
  .superRefine((s, ctx) => {
    s.items?.forEach((item, i) => {
      for (const [k, v] of Object.entries(item)) {
        if (HREF_KEYS.has(k) && !href.safeParse(v).success) ctx.addIssue({ code: "custom", path: ["items", i, k], message: `Link “${v}” isn’t allowed.` });
      }
    });
    for (const [k, v] of Object.entries(s.settings)) {
      if (HREF_KEYS.has(k) && typeof v === "string" && !href.safeParse(v).success) ctx.addIssue({ code: "custom", path: ["settings", k], message: `Link “${v}” isn’t allowed.` });
    }
  });

export const pageSchema = z
  .object({
    version: z.literal(1),
    title: z.string().max(120),
    theme: z.object({
      primary: color,
      accent: color,
      background: color,
      surface: color,
      ink: color,
      muted: color,
      fontDisplay: font,
      fontBody: font,
      radius: num(0, 40),
    }),
    sections: z.array(section).max(60),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    for (const s of p.sections) {
      if (ids.has(s.id)) ctx.addIssue({ code: "custom", path: ["sections"], message: `Duplicate section id “${s.id}”.` });
      ids.add(s.id);
    }
    for (const t of ["header", "footer"] as const) {
      if (p.sections.filter((s) => s.type === t).length > 1) ctx.addIssue({ code: "custom", path: ["sections"], message: `Only one ${t} is allowed.` });
    }
  });

/** Strict check used before saving/publishing. Returns a readable message on failure. */
export function validatePage(input: unknown): { ok: true; page: Page } | { ok: false; error: string } {
  const size = JSON.stringify(input ?? null).length;
  if (size > MAX_PAGE_BYTES) return { ok: false, error: `The page is too large (${Math.round(size / 1024)} KB; limit ${MAX_PAGE_BYTES / 1024} KB).` };
  const r = pageSchema.safeParse(input);
  if (r.success) return { ok: true, page: r.data as Page };
  const issue = r.error.issues[0];
  return { ok: false, error: `${issue.message} (at ${issue.path.join(".") || "page"})` };
}

/**
 * Make any stored page safe to render: fill missing fields from defaults, drop unknown section
 * types, replace invalid values. Falls back to the default page only if nothing usable is left.
 */
export function normalizePage(input: unknown): Page {
  if (validatePage(input).ok) return input as Page;
  const raw = (input && typeof input === "object" ? input : {}) as Partial<Page>;
  const fallbackTheme = { ...DEFAULT_THEME };
  const theme = { ...fallbackTheme, ...(raw.theme && typeof raw.theme === "object" ? raw.theme : {}) };
  for (const k of Object.keys(fallbackTheme) as (keyof typeof fallbackTheme)[]) {
    const ok = k === "radius" ? num(0, 40).safeParse(theme[k]).success : k.startsWith("font") ? font.safeParse(theme[k]).success : color.safeParse(theme[k]).success;
    if (!ok) (theme as Record<string, unknown>)[k] = fallbackTheme[k];
  }
  const fixStyle = (st: unknown): TextStyle => {
    const r = textStyle.safeParse(st);
    if (r.success) return r.data as TextStyle;
    const tag = (st as TextStyle | undefined)?.tag;
    return { tag: (TAGS as string[]).includes(tag as string) ? (tag as TextStyle["tag"]) : "p" };
  };
  const sections: Section[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    if (!s || typeof s !== "object" || !(s.type in SECTION_DEFS)) continue;
    const id = typeof s.id === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(s.id) && !seen.has(s.id) ? s.id : `${s.type}-${sections.length}`;
    seen.add(id);
    const st = sectionStyle.safeParse({ ...baseStyle(), ...(s.style ?? {}) });
    const text: Section["text"] = {};
    for (const [k, b] of Object.entries(s.text ?? {})) {
      if (b && typeof b === "object") text[k] = { text: String((b as { text?: unknown }).text ?? "").slice(0, 5000), style: fixStyle((b as { style?: unknown }).style) };
    }
    const items = Array.isArray(s.items)
      ? s.items.slice(0, 50).map((it) => Object.fromEntries(Object.entries(it ?? {}).map(([k, v]) => [k, HREF_KEYS.has(k) && !href.safeParse(String(v)).success ? "#" : String(v ?? "").slice(0, 2000)])))
      : undefined;
    const itemStyles = s.itemStyles ? Object.fromEntries(Object.entries(s.itemStyles).map(([k, v]) => [k, fixStyle(v)])) : undefined;
    const settings: Section["settings"] = {};
    for (const [k, v] of Object.entries(s.settings ?? {})) {
      if (!settingValue.safeParse(v).success) continue;
      settings[k] = HREF_KEYS.has(k) && typeof v === "string" && !href.safeParse(v).success ? "#" : v;
    }
    sections.push({ id, type: s.type, name: typeof s.name === "string" ? s.name.slice(0, 80) : undefined, hidden: !!s.hidden, style: st.success ? (st.data as Section["style"]) : baseStyle(), text, items, itemStyles, settings });
  }
  const page: Page = { version: 1, title: typeof raw.title === "string" ? raw.title.slice(0, 120) : "Landing page", theme, sections: sections.slice(0, 60) };
  return validatePage(page).ok ? page : defaultPage();
}

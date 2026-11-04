import type React from "react";

// CMS content model. A Page is an ordered list of Sections. Every piece of text is a TextBlock with its
// own typography, and every section carries its own styling — all editable without code.

export type Tag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
export const TAGS: Tag[] = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span"];
export type Align = "left" | "center" | "right";

export interface TextStyle {
  tag: Tag;
  fontSize?: number | null; // px; null = default for tag
  weight?: number | null; // 300–800; null = default
  italic?: boolean;
  underline?: boolean;
  overline?: boolean;
  strike?: boolean;
  color?: string | null;
  align?: Align | null; // null = inherit section alignment
  letterSpacing?: number | null; // em
  lineHeight?: number | null;
  transform?: "none" | "uppercase" | "lowercase" | "capitalize";
  font?: "display" | "body" | null;
}

export interface TextBlock {
  text: string;
  style: TextStyle;
}

export interface SectionStyle {
  bgType: "none" | "color" | "gradient" | "image";
  bgColor: string;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  bgImage: string;
  overlay: number; // 0–0.9 dark overlay over images
  textColor: string | null;
  align: Align;
  paddingY: number; // px
  width: "narrow" | "normal" | "wide" | "full";
  radius: number; // inner card radius px (used by some sections)
}

export type SectionType =
  | "header"
  | "hero"
  | "stats"
  | "featured"
  | "locations"
  | "features"
  | "text"
  | "cta"
  | "testimonials"
  | "footer";

export type ItemRecord = Record<string, string>;

export interface Section {
  id: string;
  type: SectionType;
  name?: string;
  hidden?: boolean;
  style: SectionStyle;
  text: Record<string, TextBlock>;
  items?: ItemRecord[];
  itemStyles?: Record<string, TextStyle>;
  settings: Record<string, string | number | boolean>;
}

export interface Theme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  fontDisplay: string;
  fontBody: string;
  radius: number;
}

export interface Page {
  version: 1;
  title: string;
  theme: Theme;
  sections: Section[];
}

export const FONT_OPTIONS = [
  { label: "Fraunces (serif)", value: "'Fraunces', Georgia, serif" },
  { label: "Playfair Display (serif)", value: "'Playfair Display', Georgia, serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', Georgia, serif" },
  { label: "Lora (serif)", value: "'Lora', Georgia, serif" },
  { label: "Manrope (sans)", value: "'Manrope', system-ui, sans-serif" },
  { label: "DM Sans (sans)", value: "'DM Sans', system-ui, sans-serif" },
  { label: "Poppins (sans)", value: "'Poppins', system-ui, sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
];

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..800&family=DM+Serif+Display&family=Fraunces:opsz,wght@9..144,300..800&family=Lora:wght@400..700&family=Manrope:wght@300..800&family=Playfair+Display:wght@400..800&family=Poppins:wght@300;400;500;600;700;800&display=swap";

// ---------------------------------------------------------------------------
// Section registry (drives the editor UI)
// ---------------------------------------------------------------------------

export interface SettingDef {
  key: string;
  label: string;
  type: "toggle" | "number" | "select" | "text";
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  hint?: string;
}

export interface ItemFieldDef {
  key: string;
  label: string;
  multiline?: boolean;
  options?: { label: string; value: string }[];
  /** Not rendered as editable text on the canvas (e.g. link URL, icon name). */
  meta?: boolean;
}

export interface SectionDef {
  type: SectionType;
  label: string;
  description: string;
  textRoles: { key: string; label: string; multiline?: boolean }[];
  itemLabel?: string;
  itemFields?: ItemFieldDef[];
  settings: SettingDef[];
  /** Can only appear once & cannot be added from the library */
  singleton?: boolean;
}

export const ICONS = ["search", "shield", "spark", "home", "map", "key", "chart", "chat", "leaf", "star"] as const;
const ICON_OPTIONS = ICONS.map((i) => ({ label: i, value: i }));

export const SECTION_DEFS: Record<SectionType, SectionDef> = {
  header: {
    type: "header",
    label: "Header",
    description: "Logo, navigation links and a call-to-action button.",
    textRoles: [
      { key: "brand", label: "Brand name" },
      { key: "cta", label: "Button" },
    ],
    itemLabel: "Link",
    itemFields: [
      { key: "label", label: "Label" },
      { key: "href", label: "URL", meta: true },
    ],
    settings: [
      { key: "sticky", label: "Stick to top while scrolling", type: "toggle" },
      { key: "showCta", label: "Show button", type: "toggle" },
      { key: "ctaHref", label: "Button link", type: "text" },
    ],
    singleton: true,
  },
  hero: {
    type: "hero",
    label: "Hero with search",
    description: "Large headline with the property search bar and quick-search chips.",
    textRoles: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "heading", label: "Headline" },
      { key: "subheading", label: "Sub-headline", multiline: true },
    ],
    itemLabel: "Quick search",
    itemFields: [{ key: "label", label: "Search text" }],
    settings: [
      { key: "showSearch", label: "Show search bar", type: "toggle" },
      { key: "placeholder", label: "Search placeholder", type: "text" },
      { key: "showChips", label: "Show quick searches", type: "toggle" },
      { key: "minHeight", label: "Minimum height (vh)", type: "number", min: 0, max: 100 },
    ],
  },
  stats: {
    type: "stats",
    label: "Stats strip",
    description: "A row of highlight numbers.",
    textRoles: [],
    itemLabel: "Stat",
    itemFields: [
      { key: "value", label: "Value" },
      { key: "label", label: "Label" },
    ],
    settings: [],
  },
  featured: {
    type: "featured",
    label: "Featured properties",
    description: "A grid of listings pulled live from the property inventory.",
    textRoles: [
      { key: "heading", label: "Heading" },
      { key: "subheading", label: "Sub-heading", multiline: true },
      { key: "link", label: "Link text" },
    ],
    settings: [
      {
        key: "source",
        label: "Show",
        type: "select",
        options: [
          { label: "Featured listings", value: "featured" },
          { label: "Newest listings", value: "newest" },
          { label: "Bangalore", value: "city:bangalore" },
          { label: "Murud Janjira", value: "city:murud-janjira" },
          { label: "Pune", value: "city:pune" },
          { label: "Mumbai", value: "city:mumbai" },
        ],
      },
      { key: "count", label: "Number of listings", type: "number", min: 1, max: 12 },
      { key: "showLink", label: "Show “view all” link", type: "toggle" },
    ],
  },
  locations: {
    type: "locations",
    label: "Browse by city",
    description: "City tiles that link to search results.",
    textRoles: [
      { key: "heading", label: "Heading" },
      { key: "subheading", label: "Sub-heading", multiline: true },
    ],
    itemLabel: "City",
    itemFields: [
      { key: "city", label: "City name" },
      { key: "caption", label: "Caption" },
      { key: "slug", label: "City (search target)", meta: true, options: [
        { label: "Bangalore", value: "bangalore" },
        { label: "Murud Janjira", value: "murud-janjira" },
        { label: "Pune", value: "pune" },
        { label: "Mumbai", value: "mumbai" },
      ] },
    ],
    settings: [{ key: "showCounts", label: "Show listing counts", type: "toggle" }],
  },
  features: {
    type: "features",
    label: "Feature grid",
    description: "Icon + title + text cards.",
    textRoles: [
      { key: "heading", label: "Heading" },
      { key: "subheading", label: "Sub-heading", multiline: true },
    ],
    itemLabel: "Feature",
    itemFields: [
      { key: "icon", label: "Icon", meta: true, options: ICON_OPTIONS },
      { key: "title", label: "Title" },
      { key: "body", label: "Text", multiline: true },
    ],
    settings: [
      {
        key: "columns",
        label: "Columns",
        type: "select",
        options: [
          { label: "2", value: "2" },
          { label: "3", value: "3" },
          { label: "4", value: "4" },
        ],
      },
      { key: "cards", label: "Show as cards", type: "toggle" },
    ],
  },
  text: {
    type: "text",
    label: "Text block",
    description: "A heading and a paragraph — about us, policies, anything.",
    textRoles: [
      { key: "heading", label: "Heading" },
      { key: "body", label: "Body", multiline: true },
    ],
    settings: [],
  },
  cta: {
    type: "cta",
    label: "Call to action",
    description: "A banner with a heading, text and a button.",
    textRoles: [
      { key: "heading", label: "Heading" },
      { key: "body", label: "Text", multiline: true },
      { key: "button", label: "Button" },
    ],
    settings: [
      { key: "href", label: "Button link", type: "text" },
      { key: "boxed", label: "Show as a card", type: "toggle" },
    ],
  },
  testimonials: {
    type: "testimonials",
    label: "Testimonials",
    description: "Quotes from buyers.",
    textRoles: [{ key: "heading", label: "Heading" }],
    itemLabel: "Testimonial",
    itemFields: [
      { key: "quote", label: "Quote", multiline: true },
      { key: "name", label: "Name" },
      { key: "role", label: "Detail" },
    ],
    settings: [],
  },
  footer: {
    type: "footer",
    label: "Footer",
    description: "Brand, tagline, links and copyright.",
    textRoles: [
      { key: "brand", label: "Brand" },
      { key: "tagline", label: "Tagline", multiline: true },
      { key: "copyright", label: "Copyright" },
    ],
    itemLabel: "Link",
    itemFields: [
      { key: "label", label: "Label" },
      { key: "href", label: "URL", meta: true },
    ],
    settings: [],
    singleton: true,
  },
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const uid = () => Math.random().toString(36).slice(2, 9);

export const baseStyle = (o: Partial<SectionStyle> = {}): SectionStyle => ({
  bgType: "none",
  bgColor: "#ffffff",
  gradFrom: "#1f3a2e",
  gradTo: "#335c48",
  gradAngle: 135,
  bgImage: "",
  overlay: 0.45,
  textColor: null,
  align: "left",
  paddingY: 72,
  width: "normal",
  radius: 18,
  ...o,
});

export const t = (text: string, style: Partial<TextStyle> & { tag: Tag }): TextBlock => ({ text, style: { ...style } });

export function createSection(type: SectionType): Section {
  const id = `${type}-${uid()}`;
  switch (type) {
    case "header":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 18, width: "wide", bgType: "color", bgColor: "#fbf8f3" }),
        text: {
          brand: t("Nivaas", { tag: "span", fontSize: 24, weight: 700, font: "display" }),
          cta: t("List your property", { tag: "span" }),
        },
        items: [
          { label: "Buy", href: "/search" },
          { label: "Bangalore", href: "/search?city=bangalore&f=1" },
          { label: "Murud Janjira", href: "/search?city=murud-janjira&f=1" },
          { label: "Pune", href: "/search?city=pune&f=1" },
        ],
        itemStyles: { label: { tag: "span", fontSize: 15, weight: 500 } },
        settings: { sticky: true, showCta: true, ctaHref: "#contact" },
      };
    case "hero":
      return {
        id,
        type,
        style: baseStyle({ bgType: "gradient", gradFrom: "#1f3a2e", gradTo: "#2f5a45", gradAngle: 160, textColor: "#fbf8f3", paddingY: 96, align: "left", width: "wide" }),
        text: {
          eyebrow: t("Verified homes · RERA details on every listing", { tag: "p", fontSize: 13, weight: 600, transform: "uppercase", letterSpacing: 0.12, color: "#e9b79f" }),
          heading: t("Find a home that fits the way you live", { tag: "h1", fontSize: 64, weight: 600, font: "display", lineHeight: 1.05 }),
          subheading: t("Search the way you talk — “3 BHK in Whitefield under 2 Cr” or “villa in Murud Janjira”. We’ll show every match, and homes like the ones you love.", { tag: "p", fontSize: 19, lineHeight: 1.55 }),
        },
        items: [
          { label: "2 BHK in Bangalore" },
          { label: "3 BHK in Madhli Aai, Murud Janjira" },
          { label: "4 BHK in Koramangala" },
          { label: "Villas in Murud under 2 Cr" },
          { label: "Ready to move flats in Powai" },
        ],
        itemStyles: { label: { tag: "span", fontSize: 14, weight: 500 } },
        settings: { showSearch: true, placeholder: "Try “3 BHK in Bangalore under 1 Cr”", showChips: true, minHeight: 0 },
      };
    case "stats":
      return {
        id,
        type,
        style: baseStyle({ bgType: "color", bgColor: "#f3ece1", paddingY: 40, align: "center", width: "wide" }),
        text: {},
        items: [
          { value: "4 cities", label: "Bangalore, Murud Janjira, Pune & Mumbai" },
          { value: "100%", label: "listings show RERA status" },
          { value: "3 levels", label: "city → locality → area search" },
          { value: "0", label: "brokerage on new projects" },
        ],
        itemStyles: {
          value: { tag: "p", fontSize: 34, weight: 600, font: "display" },
          label: { tag: "p", fontSize: 14 },
        },
        settings: {},
      };
    case "featured":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 80, width: "wide" }),
        text: {
          heading: t("Handpicked this week", { tag: "h2", fontSize: 40, weight: 600, font: "display" }),
          subheading: t("Homes our team has visited and verified, from city apartments to Konkan coast villas.", { tag: "p", fontSize: 17 }),
          link: t("View all properties →", { tag: "span", weight: 600 }),
        },
        settings: { source: "featured", count: 6, showLink: true },
      };
    case "locations":
      return {
        id,
        type,
        style: baseStyle({ bgType: "color", bgColor: "#f3ece1", paddingY: 80, width: "wide" }),
        text: {
          heading: t("Browse by city", { tag: "h2", fontSize: 40, weight: 600, font: "display" }),
          subheading: t("Start broad, then narrow down by locality and area.", { tag: "p", fontSize: 17 }),
        },
        items: [
          { city: "Bangalore", caption: "Whitefield, HSR, Koramangala & more", slug: "bangalore" },
          { city: "Murud Janjira", caption: "Sea-facing villas & weekend homes", slug: "murud-janjira" },
          { city: "Pune", caption: "Kharadi, Baner, Hinjewadi", slug: "pune" },
          { city: "Mumbai", caption: "Powai, Andheri, Bandra, Thane", slug: "mumbai" },
        ],
        itemStyles: {
          city: { tag: "h3", fontSize: 26, weight: 600, font: "display" },
          caption: { tag: "p", fontSize: 14 },
        },
        settings: { showCounts: true },
      };
    case "features":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 88, width: "wide" }),
        text: {
          heading: t("Built for how people actually look for homes", { tag: "h2", fontSize: 40, weight: 600, font: "display" }),
          subheading: t("Every listing carries the details that matter, and every home leads you to others like it.", { tag: "p", fontSize: 17 }),
        },
        items: [
          { icon: "search", title: "Search that understands you", body: "Type a city, locality, configuration or budget in plain words — even “Bangalore mein 2BHK”. Filters do the rest." },
          { icon: "shield", title: "Every detail, upfront", body: "RERA status and number, carpet & super built-up area, floor, facing, amenities, possession — on every property page." },
          { icon: "spark", title: "Homes like the one you love", body: "Open any property to see similar homes in the same area, configuration and price range." },
        ],
        itemStyles: {
          title: { tag: "h3", fontSize: 21, weight: 600 },
          body: { tag: "p", fontSize: 15, lineHeight: 1.6 },
        },
        settings: { columns: "3", cards: true },
      };
    case "text":
      return {
        id,
        type,
        style: baseStyle({ width: "narrow" }),
        text: {
          heading: t("About us", { tag: "h2", fontSize: 36, weight: 600, font: "display" }),
          body: t("Write anything here. Use the panel on the right to change the heading level, size, weight and decoration.", { tag: "p", fontSize: 17, lineHeight: 1.7 }),
        },
        settings: {},
      };
    case "cta":
      return {
        id,
        type,
        style: baseStyle({ bgType: "color", bgColor: "#c8553d", textColor: "#fff8f2", align: "center", paddingY: 72, width: "normal" }),
        text: {
          heading: t("Selling or renting out a home?", { tag: "h2", fontSize: 38, weight: 600, font: "display" }),
          body: t("List it with us and reach buyers searching your exact locality.", { tag: "p", fontSize: 18 }),
          button: t("Talk to our team", { tag: "span", weight: 600 }),
        },
        settings: { href: "#contact", boxed: false },
      };
    case "testimonials":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 80, width: "wide" }),
        text: { heading: t("What buyers say", { tag: "h2", fontSize: 36, weight: 600, font: "display" }) },
        items: [
          { quote: "Replace this with a quote from a real customer.", name: "Customer name", role: "Bought a 3 BHK in …" },
          { quote: "Replace this with a quote from a real customer.", name: "Customer name", role: "Bought a villa in …" },
        ],
        itemStyles: {
          quote: { tag: "p", fontSize: 19, italic: true, lineHeight: 1.5, font: "display" },
          name: { tag: "p", fontSize: 15, weight: 700 },
          role: { tag: "p", fontSize: 13 },
        },
        settings: {},
      };
    case "footer":
      return {
        id,
        type,
        style: baseStyle({ bgType: "color", bgColor: "#16261f", textColor: "#d9d4ca", paddingY: 56, width: "wide" }),
        text: {
          brand: t("Nivaas", { tag: "p", fontSize: 26, weight: 700, font: "display", color: "#fbf8f3" }),
          tagline: t("Homes across Bangalore, Murud Janjira, Pune and Mumbai.", { tag: "p", fontSize: 15 }),
          copyright: t("© 2026 Nivaas Realty. Listing details are provided by sellers; verify RERA information on the official portal.", { tag: "p", fontSize: 13, color: "#8f9a92" }),
        },
        items: [
          { label: "Search properties", href: "/search" },
          { label: "Bangalore", href: "/search?city=bangalore&f=1" },
          { label: "Murud Janjira", href: "/search?city=murud-janjira&f=1" },
          { label: "Admin", href: "/admin" },
        ],
        itemStyles: { label: { tag: "span", fontSize: 14 } },
        settings: {},
      };
  }
}

export const DEFAULT_THEME: Theme = {
  primary: "#1f3a2e",
  accent: "#c8553d",
  background: "#fbf8f3",
  surface: "#ffffff",
  ink: "#1c2420",
  muted: "#5d6b63",
  fontDisplay: "'Fraunces', Georgia, serif",
  fontBody: "'Manrope', system-ui, sans-serif",
  radius: 14,
};

export function defaultPage(): Page {
  return {
    version: 1,
    title: "Landing page",
    theme: { ...DEFAULT_THEME },
    sections: (["header", "hero", "stats", "featured", "features", "locations", "cta", "footer"] as SectionType[]).map((type) => ({
      ...createSection(type),
      id: type, // stable ids for the defaults
    })),
  };
}

// ---------------------------------------------------------------------------
// Style helpers (shared by renderer & editor)
// ---------------------------------------------------------------------------

const DEFAULT_SIZES: Record<Tag, number> = { h1: 56, h2: 40, h3: 28, h4: 22, h5: 18, h6: 16, p: 16, span: 16 };
export const defaultSizeFor = (tag: Tag) => DEFAULT_SIZES[tag];

export function textCss(s: TextStyle): React.CSSProperties {
  const deco = [s.underline && "underline", s.overline && "overline", s.strike && "line-through"].filter(Boolean).join(" ");
  const css: React.CSSProperties = {};
  if (s.fontSize) {
    // Large sizes scale down fluidly on narrow screens (relative to the site container), never above the chosen size.
    css.fontSize = s.fontSize >= 30 ? `clamp(${Math.round(s.fontSize * 0.58)}px, ${(s.fontSize / 12).toFixed(2)}cqi, ${s.fontSize}px)` : `${s.fontSize}px`;
  }
  if (s.weight) css.fontWeight = s.weight;
  if (s.italic) css.fontStyle = "italic";
  if (deco) css.textDecorationLine = deco;
  if (s.color) css.color = s.color;
  if (s.align) css.textAlign = s.align;
  if (s.letterSpacing) css.letterSpacing = `${s.letterSpacing}em`;
  if (s.lineHeight) css.lineHeight = s.lineHeight;
  if (s.transform && s.transform !== "none") css.textTransform = s.transform;
  if (s.font === "display") css.fontFamily = "var(--font-display)";
  if (s.font === "body") css.fontFamily = "var(--font-body)";
  return css;
}

export function sectionCss(st: SectionStyle): React.CSSProperties {
  const css: React.CSSProperties & Record<string, string | number> = {
    paddingTop: st.paddingY,
    paddingBottom: st.paddingY,
    textAlign: st.align,
  };
  if (st.bgType === "color") css.background = st.bgColor;
  if (st.bgType === "gradient") css.background = `linear-gradient(${st.gradAngle}deg, ${st.gradFrom}, ${st.gradTo})`;
  if (st.bgType === "image" && st.bgImage) {
    css.backgroundImage = `linear-gradient(rgba(0,0,0,${st.overlay}), rgba(0,0,0,${st.overlay})), url("${st.bgImage.replace(/"/g, "")}")`;
    css.backgroundSize = "cover";
    css.backgroundPosition = "center";
  }
  if (st.textColor) {
    css.color = st.textColor;
    css["--section-ink"] = st.textColor;
    css["--section-muted"] = `color-mix(in srgb, ${st.textColor} 74%, transparent)`;
  }
  css["--section-radius"] = `${st.radius}px`;
  return css;
}

export function themeCss(th: Theme): React.CSSProperties {
  return {
    "--c-primary": th.primary,
    "--c-accent": th.accent,
    "--c-bg": th.background,
    "--c-surface": th.surface,
    "--c-ink": th.ink,
    "--c-muted": th.muted,
    "--font-display": th.fontDisplay,
    "--font-body": th.fontBody,
    "--radius": `${th.radius}px`,
  } as React.CSSProperties;
}

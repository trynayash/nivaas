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

export const FONT_OPTIONS: { label: string; value: string; google?: string }[] = [
  { label: "Newsreader (serif)", value: "'Newsreader', Georgia, serif", google: "Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700" },
  { label: "Source Serif 4", value: "'Source Serif 4', Georgia, serif", google: "Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700" },
  { label: "IBM Plex Serif", value: "'IBM Plex Serif', Georgia, serif", google: "IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400" },
  { label: "Lora (serif)", value: "'Lora', Georgia, serif", google: "Lora:ital,wght@0,400..700;1,400..700" },
  { label: "IBM Plex Sans", value: "'IBM Plex Sans', system-ui, sans-serif", google: "IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400" },
  { label: "Public Sans", value: "'Public Sans', system-ui, sans-serif", google: "Public+Sans:ital,wght@0,300..800;1,300..800" },
  { label: "Libre Franklin", value: "'Libre Franklin', system-ui, sans-serif", google: "Libre+Franklin:ital,wght@0,300..800;1,300..800" },
  { label: "System UI", value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
];

/** Google Fonts stylesheet for exactly the fonts a theme uses (plus IBM Plex Mono for figures/IDs). */
export function fontsHref(fonts: string[]): string {
  const families = new Set<string>(["IBM+Plex+Mono:wght@400;500"]);
  for (const f of fonts) {
    const opt = FONT_OPTIONS.find((o) => o.value === f);
    if (opt?.google) families.add(opt.google);
  }
  return `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join("&")}&display=swap`;
}

export const STUDIO_FONTS_HREF = fontsHref(["'IBM Plex Sans', system-ui, sans-serif", "'Newsreader', Georgia, serif"]);

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
      { key: "ctaHref", label: "Button link", type: "text", hint: "#contact opens WhatsApp chat (number set in CONTACT_WHATSAPP)." },
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
      { key: "showIndex", label: "Show listings-by-city index", type: "toggle", hint: "Live counts from the property inventory." },
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
    label: "Browse by locality",
    description: "Cities with their localities and live listing counts, linking to search.",
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
    settings: [
      { key: "showCounts", label: "Show listing counts", type: "toggle" },
      { key: "showLocalities", label: "List localities under each city", type: "toggle" },
    ],
  },
  features: {
    type: "features",
    label: "Feature list",
    description: "Short titled points in columns, optionally numbered.",
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
      { key: "cards", label: "Show as boxes", type: "toggle" },
      { key: "numbered", label: "Number the items (01, 02…)", type: "toggle" },
      { key: "showIcons", label: "Show icons", type: "toggle" },
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
      { key: "href", label: "Button link", type: "text", hint: "#contact opens WhatsApp chat (number set in CONTACT_WHATSAPP)." },
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
  gradFrom: "#1d211e",
  gradTo: "#3b413c",
  gradAngle: 180,
  bgImage: "",
  overlay: 0.45,
  textColor: null,
  align: "left",
  paddingY: 64,
  width: "wide",
  radius: 4,
  ...o,
});

export const t = (text: string, style: Partial<TextStyle> & { tag: Tag }): TextBlock => ({ text, style: { ...style } });

const H2 = { tag: "h2" as const, fontSize: 34, weight: 400, font: "display" as const, lineHeight: 1.15 };

export function createSection(type: SectionType): Section {
  const id = `${type}-${uid()}`;
  switch (type) {
    case "header":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 16 }),
        text: {
          brand: t("Nivaas", { tag: "span", fontSize: 26, weight: 500, font: "display" }),
          cta: t("List a property", { tag: "span" }),
        },
        items: [
          { label: "Bangalore", href: "/search?city=bangalore&f=1" },
          { label: "Pune", href: "/search?city=pune&f=1" },
          { label: "Mumbai", href: "/search?city=mumbai&f=1" },
          { label: "Murud Janjira", href: "/search?city=murud-janjira&f=1" },
          { label: "All listings", href: "/search" },
        ],
        itemStyles: { label: { tag: "span", fontSize: 15 } },
        settings: { sticky: true, showCta: true, ctaHref: "#contact" },
      };
    case "hero":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 64 }),
        text: {
          eyebrow: t("", { tag: "p", fontSize: 14 }),
          heading: t("Flats, villas and plots in Bangalore, Pune, Mumbai and Murud Janjira", {
            tag: "h1",
            fontSize: 54,
            weight: 400,
            font: "display",
            lineHeight: 1.06,
            letterSpacing: -0.012,
          }),
          subheading: t(
            "Search by locality, BHK and budget — “3 BHK in Whitefield” or “villa in Madhli Aai under 1.5 Cr”. Every listing shows its RERA number, carpet area and possession date.",
            { tag: "p", fontSize: 18, lineHeight: 1.55 }
          ),
        },
        items: [
          { label: "2 BHK in HSR Layout" },
          { label: "3 BHK in Madhli Aai, Murud Janjira" },
          { label: "Villas in Murud under 2 Cr" },
          { label: "Ready to move flats in Powai" },
          { label: "Plots in Murud Janjira" },
        ],
        itemStyles: { label: { tag: "span", fontSize: 15 } },
        settings: { showSearch: true, placeholder: "Locality, city, BHK or budget", showChips: true, showIndex: true, minHeight: 0 },
      };
    case "stats":
      return {
        id,
        type,
        style: baseStyle({ paddingY: 40 }),
        text: {},
        items: [
          { value: "RERA", label: "status and number on every listing" },
          { value: "3 areas", label: "carpet, built-up and super built-up" },
          { value: "₹/sq.ft", label: "compared with the locality average" },
        ],
        itemStyles: {
          value: { tag: "p", fontSize: 30, weight: 400, font: "display" },
          label: { tag: "p", fontSize: 14 },
        },
        settings: {},
      };
    case "featured":
      return {
        id,
        type,
        style: baseStyle(),
        text: {
          heading: t("Recently listed", { ...H2 }),
          subheading: t("Newest first. Prices are the seller’s asking price; price per sq.ft is on super built-up area.", { tag: "p", fontSize: 16 }),
          link: t("All listings →", { tag: "span", weight: 500 }),
        },
        settings: { source: "newest", count: 6, showLink: true },
      };
    case "locations":
      return {
        id,
        type,
        style: baseStyle(),
        text: {
          heading: t("Browse by locality", { ...H2 }),
          subheading: t("Counts update as listings are added.", { tag: "p", fontSize: 16 }),
        },
        items: [
          { city: "Bangalore", caption: "East and south Bangalore, Hebbal and Yelahanka", slug: "bangalore" },
          { city: "Murud Janjira", caption: "Konkan coast: Madhli Aai, Rajpuri, Nandgaon, Kashid", slug: "murud-janjira" },
          { city: "Pune", caption: "Kharadi and Viman Nagar, Baner and the Hinjewadi belt", slug: "pune" },
          { city: "Mumbai", caption: "Powai, Andheri West, Bandra West and Thane", slug: "mumbai" },
        ],
        itemStyles: {
          city: { tag: "h3", fontSize: 24, weight: 400, font: "display" },
          caption: { tag: "p", fontSize: 14 },
        },
        settings: { showCounts: true, showLocalities: true },
      };
    case "features":
      return {
        id,
        type,
        style: baseStyle(),
        text: {
          heading: t("What every listing shows", { ...H2 }),
          subheading: t("So you can compare homes before calling anyone.", { tag: "p", fontSize: 16 }),
        },
        items: [
          {
            icon: "shield",
            title: "RERA status",
            body: "The registration number and authority — or why registration doesn’t apply, such as a resale flat completed before 2017 or an individual plot.",
          },
          {
            icon: "chart",
            title: "Three area figures",
            body: "Carpet, built-up and super built-up area listed separately, with price per sq.ft against the locality average.",
          },
          {
            icon: "key",
            title: "Possession and floor",
            body: "Ready to move or the promised possession month, the floor and number of floors, facing and parking.",
          },
          {
            icon: "spark",
            title: "Similar homes, with reasons",
            body: "Each property page lists comparable homes nearby and says why: same area, same BHK, price within 10%.",
          },
        ],
        itemStyles: {
          title: { tag: "h3", fontSize: 18, weight: 600 },
          body: { tag: "p", fontSize: 15, lineHeight: 1.6 },
        },
        settings: { columns: "4", cards: false, numbered: true, showIcons: false },
      };
    case "text":
      return {
        id,
        type,
        style: baseStyle({ width: "narrow" }),
        text: {
          heading: t("About us", { ...H2 }),
          body: t("Write anything here. Use the panel on the right to change the heading level, size, weight and decoration.", {
            tag: "p",
            fontSize: 17,
            lineHeight: 1.7,
          }),
        },
        settings: {},
      };
    case "cta":
      return {
        id,
        type,
        style: baseStyle(),
        text: {
          heading: t("Selling a flat in Whitefield or a bungalow in Murud?", { ...H2, fontSize: 30 }),
          body: t("We list resale and new-launch homes with the same details buyers see here: RERA status, all three area figures and the possession date.", {
            tag: "p",
            fontSize: 16,
            lineHeight: 1.6,
          }),
          button: t("Talk to the listings team", { tag: "span", weight: 500 }),
        },
        settings: { href: "#contact", boxed: true },
      };
    case "testimonials":
      return {
        id,
        type,
        style: baseStyle(),
        text: { heading: t("What buyers say", { ...H2 }) },
        items: [
          { quote: "Replace this with a quote from a real customer.", name: "Customer name", role: "Bought a 3 BHK in …" },
          { quote: "Replace this with a quote from a real customer.", name: "Customer name", role: "Bought a villa in …" },
        ],
        itemStyles: {
          quote: { tag: "p", fontSize: 20, lineHeight: 1.45, font: "display" },
          name: { tag: "p", fontSize: 15, weight: 600 },
          role: { tag: "p", fontSize: 14 },
        },
        settings: {},
      };
    case "footer":
      return {
        id,
        type,
        style: baseStyle({ bgType: "color", bgColor: "#1d211e", textColor: "#e8e5de", paddingY: 48 }),
        text: {
          brand: t("Nivaas", { tag: "p", fontSize: 24, weight: 500, font: "display" }),
          tagline: t("Residential listings in Bangalore, Pune, Mumbai and Murud Janjira.", { tag: "p", fontSize: 15 }),
          copyright: t(
            "© 2026 Nivaas Realty. Listing details come from sellers. Check RERA registration on your state authority’s website before paying a booking amount.",
            { tag: "p", fontSize: 13 }
          ),
        },
        items: [
          { label: "All listings", href: "/search" },
          { label: "Bangalore", href: "/search?city=bangalore&f=1" },
          { label: "Pune", href: "/search?city=pune&f=1" },
          { label: "Mumbai", href: "/search?city=mumbai&f=1" },
          { label: "Murud Janjira", href: "/search?city=murud-janjira&f=1" },
        ],
        itemStyles: { label: { tag: "span", fontSize: 14 } },
        settings: {},
      };
  }
}

export const DEFAULT_THEME: Theme = {
  primary: "#1d211e",
  accent: "#9b3d23",
  background: "#f5f3ee",
  surface: "#fcfbf8",
  ink: "#1d211e",
  muted: "#66635b",
  fontDisplay: "'Newsreader', Georgia, serif",
  fontBody: "'IBM Plex Sans', system-ui, sans-serif",
  radius: 4,
};

export function defaultPage(): Page {
  return {
    version: 1,
    title: "Landing page",
    theme: { ...DEFAULT_THEME },
    sections: (["header", "hero", "featured", "features", "locations", "cta", "footer"] as SectionType[]).map((type) => ({
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

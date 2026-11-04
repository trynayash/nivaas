"use client";

import Link from "next/link";
import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Page, Section, SECTION_DEFS, TextBlock, TextStyle, fontsHref, sectionCss, textCss, themeCss } from "@/lib/cms/schema";
import { getCity } from "@/lib/locations";
import { queryToParams } from "@/lib/search";
import { cx } from "@/lib/format";
import { type ContactConfig, resolveContactHref } from "@/lib/contact";
import type { PropertySummary } from "@/lib/types";
import { PropertyCard } from "../PropertyCard";
import { SearchBar } from "../SearchBar";
import { Icon } from "../Icon";

export interface EditorBridge {
  selectedSection?: string;
  selectedPath?: string; // "t:<role>" or "i:<index>:<field>"
  select(sectionId: string, path?: string): void;
  setText(sectionId: string, path: string, text: string): void;
}

export interface RenderCtx {
  properties: PropertySummary[];
  cityCounts: Record<string, number>;
  localities?: Record<string, { slug: string; name: string; count: number }[]>;
  /** Where "#contact" links go (WhatsApp click-to-chat when CONTACT_WHATSAPP is set). */
  contact?: ContactConfig;
  editor?: EditorBridge;
}

/** A CMS link: internal paths use <Link>, contact/external links open in a new tab. */
function CmsLink({ href, ctx, className, children }: { href: string; ctx: RenderCtx; className?: string; children: ReactNode }) {
  const r = resolveContactHref(href || "#", ctx.contact);
  if (r.external) {
    return (
      <a href={r.href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  if (r.href.startsWith("/")) {
    return (
      <Link href={r.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={r.href} className={className}>
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Editable text
// ---------------------------------------------------------------------------

function Editable({ s, path, block, className, ctx }: { s: Section; path: string; block: TextBlock; className?: string; ctx: RenderCtx }) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (block.style.tag || "p") as "p";
  const style = textCss(block.style);
  const ed = ctx.editor;
  if (!ed) {
    return (
      <Tag className={className} style={style}>
        {block.text}
      </Tag>
    );
  }
  const selected = ed.selectedSection === s.id && ed.selectedPath === path;
  return (
    <Tag
      key={`${block.text}`}
      ref={ref as never}
      className={cx(className, "ed-text", selected && "is-selected")}
      style={style}
      data-ed-tag={block.style.tag.toUpperCase()}
      contentEditable={selected}
      suppressContentEditableWarning
      spellCheck={selected}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selected) {
          ed.select(s.id, path);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.isConnected && el.focus());
        }
      }}
      onBlur={(e) => {
        const v = e.currentTarget.innerText.replace(/\n$/, "");
        if (v !== block.text) ed.setText(s.id, path, v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    >
      {block.text}
    </Tag>
  );
}

const T = ({ s, role, className, ctx }: { s: Section; role: string; className?: string; ctx: RenderCtx }) => {
  const block = s.text[role];
  if (!block) return null;
  if (!block.text && !ctx.editor) return null;
  return <Editable s={s} path={`t:${role}`} block={block} className={className} ctx={ctx} />;
};

const I = ({ s, idx, field, className, ctx }: { s: Section; idx: number; field: string; className?: string; ctx: RenderCtx }) => {
  const style: TextStyle = s.itemStyles?.[field] ?? { tag: "span" };
  const text = s.items?.[idx]?.[field] ?? "";
  if (!text && !ctx.editor) return null;
  return <Editable s={s} path={`i:${idx}:${field}`} block={{ text, style }} className={className} ctx={ctx} />;
};

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function Shell({
  s,
  ctx,
  as = "section",
  children,
  innerClass,
  style,
  innerStyle,
}: {
  s: Section;
  ctx: RenderCtx;
  as?: "section" | "header" | "footer";
  children: ReactNode;
  innerClass?: string;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
}) {
  const Tag = as;
  const ed = ctx.editor;
  const selected = ed?.selectedSection === s.id && !ed?.selectedPath;
  return (
    <Tag
      id={ed ? undefined : s.type === "cta" ? "contact" : undefined}
      className={cx(
        "sec",
        `sec-${s.type}`,
        s.style.bgType !== "none" && "has-bg",
        ed && "ed-sec",
        selected && "is-selected",
        s.hidden && "is-hidden",
        s.style.textColor && "has-ink"
      )}
      style={{ ...sectionCss(s.style), ...style }}
      data-align={s.style.align}
      data-ed-label={ed ? s.name || SECTION_DEFS[s.type].label : undefined}
      data-sec-id={ed ? s.id : undefined}
      data-sticky={s.type === "header" && s.settings.sticky ? "true" : undefined}
      onClick={
        ed
          ? (e) => {
              e.stopPropagation();
              ed.select(s.id);
            }
          : undefined
      }
    >
      <div className={cx("sec-inner", `w-${s.style.width}`, innerClass)} style={innerStyle}>
        {children}
      </div>
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export function HeaderSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx} as="header" innerClass="hdr">
      <Link href="/" className="hdr-brand">
        <T s={s} role="brand" ctx={ctx} />
      </Link>
      <nav className="hdr-nav" aria-label="Main">
        {(s.items ?? []).map((it, i) => (
          <CmsLink key={i} href={it.href} ctx={ctx}>
            <I s={s} idx={i} field="label" ctx={ctx} />
          </CmsLink>
        ))}
      </nav>
      {s.settings.showCta && (
        <CmsLink href={String(s.settings.ctaHref || "#")} ctx={ctx} className="btn btn-secondary btn-sm hdr-cta">
          <T s={s} role="cta" ctx={ctx} />
        </CmsLink>
      )}
    </Shell>
  );
}

function HeroSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  const minH = Number(s.settings.minHeight) || 0;
  const showIndex = !!s.settings.showIndex && Object.keys(ctx.cityCounts).length > 0;
  return (
    <Shell
      s={s}
      ctx={ctx}
      style={minH ? { minHeight: `${minH}vh`, display: "flex", alignItems: "center" } : undefined}
      innerClass={cx("hero", showIndex && "hero-split")}
    >
      <div className="hero-main">
        <T s={s} role="eyebrow" ctx={ctx} className="hero-eyebrow" />
        <T s={s} role="heading" ctx={ctx} className="hero-heading" />
        <T s={s} role="subheading" ctx={ctx} className="hero-sub sec-muted" />
        {s.settings.showSearch && (
          <div className="hero-search" onClick={ctx.editor ? (e) => e.stopPropagation() : undefined}>
            <SearchBar placeholder={String(s.settings.placeholder || "")} inert={!!ctx.editor} />
          </div>
        )}
        {s.settings.showChips && (s.items?.length ?? 0) > 0 && (
          <p className="hero-tries">
            <span className="sec-muted">Try</span>
            {(s.items ?? []).map((it, i) => (
              <Link key={i} href={`/search?${queryToParams(it.label).toString()}`}>
                <I s={s} idx={i} field="label" ctx={ctx} />
              </Link>
            ))}
          </p>
        )}
      </div>
      {showIndex && <CityIndex ctx={ctx} />}
    </Shell>
  );
}

/** Live listing counts per city — real numbers instead of marketing stats. */
function CityIndex({ ctx }: { ctx: RenderCtx }) {
  const rows = Object.entries(ctx.cityCounts)
    .map(([slug, count]) => ({ slug, count, name: getCity(slug)?.name ?? slug, locs: ctx.localities?.[slug]?.length ?? 0 }))
    .filter((r) => r.count > 0);
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <aside className="city-index" aria-label="Listings by city">
      <p className="city-index-title">Listings by city</p>
      <ul>
        {rows.map((r) => (
          <li key={r.slug}>
            <Link href={`/search?city=${r.slug}&f=1`}>
              <span>{r.name}</span>
              <span className="city-index-locs">{r.locs} localities</span>
              <span className="num">{r.count}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="city-index-all" href="/search">
        <span>All listings</span>
        <span className="num">{total}</span>
      </Link>
    </aside>
  );
}

function StatsSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx} innerClass="stats">
      {(s.items ?? []).map((_, i) => (
        <div key={i} className="stat">
          <I s={s} idx={i} field="value" ctx={ctx} className="stat-value" />
          <I s={s} idx={i} field="label" ctx={ctx} className="stat-label sec-muted" />
        </div>
      ))}
    </Shell>
  );
}

function pickListings(ctx: RenderCtx, source: string, count: number) {
  let list = ctx.properties;
  if (source === "featured") list = list.filter((p) => p.featured);
  else if (source === "newest") list = [...list].sort((a, b) => b.postedOn.localeCompare(a.postedOn));
  else if (source.startsWith("city:")) {
    const name = getCity(source.slice(5))?.name;
    list = list.filter((p) => p.cityName === name);
  }
  return list.slice(0, Math.max(1, count));
}

function SectionHead({ s, ctx, link }: { s: Section; ctx: RenderCtx; link?: ReactNode }) {
  return (
    <div className="sec-head">
      <div className="sec-head-text">
        <T s={s} role="heading" ctx={ctx} className="sec-title" />
        <T s={s} role="subheading" ctx={ctx} className="sec-sub sec-muted" />
      </div>
      {link}
    </div>
  );
}

function FeaturedSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  const list = pickListings(ctx, String(s.settings.source || "featured"), Number(s.settings.count) || 6);
  const source = String(s.settings.source || "");
  const href = source.startsWith("city:") ? `/search?city=${source.slice(5)}&f=1` : source === "newest" ? "/search?sort=newest&f=1" : "/search";
  return (
    <Shell s={s} ctx={ctx}>
      <SectionHead
        s={s}
        ctx={ctx}
        link={
          s.settings.showLink ? (
            <Link href={href} className="text-link sec-link">
              <T s={s} role="link" ctx={ctx} />
            </Link>
          ) : null
        }
      />
      <div className="grid-cards">
        {list.map((p) => (
          <PropertyCard key={p.id} p={p} disableLink={!!ctx.editor} />
        ))}
      </div>
    </Shell>
  );
}

function LocationsSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx}>
      <SectionHead s={s} ctx={ctx} />
      <div className="loc-cols">
        {(s.items ?? []).map((it, i) => {
          const count = ctx.cityCounts[it.slug] ?? 0;
          const locs = s.settings.showLocalities ? ctx.localities?.[it.slug] ?? [] : [];
          return (
            <div key={i} className="loc-col">
              <Link href={`/search?city=${it.slug}&f=1`} className="loc-col-head">
                <I s={s} idx={i} field="city" ctx={ctx} className="loc-city" />
                {s.settings.showCounts && <span className="num sec-muted">{count}</span>}
              </Link>
              <I s={s} idx={i} field="caption" ctx={ctx} className="loc-caption sec-muted" />
              {locs.length > 0 && (
                <ul className="loc-list">
                  {locs.map((l) => (
                    <li key={l.slug}>
                      <Link href={`/search?city=${it.slug}&loc=${l.slug}&f=1`}>
                        <span>{l.name}</span>
                        {s.settings.showCounts && <span className="num">{l.count}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function FeaturesSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx}>
      <SectionHead s={s} ctx={ctx} />
      <ol className={cx("feat-grid", s.settings.cards && "is-boxed")} style={{ "--cols": String(s.settings.columns || 3) } as CSSProperties}>
        {(s.items ?? []).map((it, i) => (
          <li key={i} className="feat">
            {s.settings.numbered && <span className="feat-num num">{String(i + 1).padStart(2, "0")}</span>}
            {s.settings.showIcons && <Icon name={it.icon || "spark"} size={22} className="feat-icon" />}
            <I s={s} idx={i} field="title" ctx={ctx} className="feat-title" />
            <I s={s} idx={i} field="body" ctx={ctx} className="feat-body sec-muted" />
          </li>
        ))}
      </ol>
    </Shell>
  );
}

function TextSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx} innerClass="prose">
      <T s={s} role="heading" ctx={ctx} className="sec-title" />
      <T s={s} role="body" ctx={ctx} className="prose-body" />
    </Shell>
  );
}

function CtaSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  const boxed = !!s.settings.boxed;
  return (
    <Shell s={s} ctx={ctx} innerClass={cx("cta", boxed && "cta-boxed")}>
      <div className="cta-text">
        <T s={s} role="heading" ctx={ctx} className="sec-title" />
        <T s={s} role="body" ctx={ctx} className="cta-body sec-muted" />
      </div>
      <CmsLink href={String(s.settings.href || "#")} ctx={ctx} className={cx("btn", s.style.textColor ? "btn-inverse" : "btn-primary")}>
        <T s={s} role="button" ctx={ctx} />
      </CmsLink>
    </Shell>
  );
}

function TestimonialsSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx}>
      <SectionHead s={s} ctx={ctx} />
      <div className="quote-grid">
        {(s.items ?? []).map((_, i) => (
          <figure key={i} className="quote">
            <I s={s} idx={i} field="quote" ctx={ctx} className="quote-text" />
            <figcaption>
              <I s={s} idx={i} field="name" ctx={ctx} />
              <I s={s} idx={i} field="role" ctx={ctx} className="sec-muted" />
            </figcaption>
          </figure>
        ))}
      </div>
    </Shell>
  );
}

export function FooterSection({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  return (
    <Shell s={s} ctx={ctx} as="footer" innerClass="ftr">
      <div className="ftr-brand">
        <T s={s} role="brand" ctx={ctx} />
        <T s={s} role="tagline" ctx={ctx} className="sec-muted" />
      </div>
      <nav className="ftr-links" aria-label="Footer">
        {(s.items ?? []).map((it, i) => (
          <CmsLink key={i} href={it.href} ctx={ctx}>
            <I s={s} idx={i} field="label" ctx={ctx} />
          </CmsLink>
        ))}
      </nav>
      <T s={s} role="copyright" ctx={ctx} className="ftr-copy sec-muted" />
    </Shell>
  );
}

const RENDERERS: Record<Section["type"], (p: { s: Section; ctx: RenderCtx }) => ReactNode> = {
  header: HeaderSection,
  hero: HeroSection,
  stats: StatsSection,
  featured: FeaturedSection,
  locations: LocationsSection,
  features: FeaturesSection,
  text: TextSection,
  cta: CtaSection,
  testimonials: TestimonialsSection,
  footer: FooterSection,
};

export function SectionView({ s, ctx }: { s: Section; ctx: RenderCtx }) {
  const R = RENDERERS[s.type];
  return R ? <R s={s} ctx={ctx} /> : null;
}

/** Loads exactly the Google Fonts the theme uses (React hoists this into <head>). */
function ThemeFonts({ page }: { page: Page }) {
  return <link rel="stylesheet" href={fontsHref([page.theme.fontDisplay, page.theme.fontBody])} precedence="default" />;
}

export function PageRenderer({ page, ctx }: { page: Page; ctx: RenderCtx }) {
  return (
    <div className="site" style={themeCss(page.theme)}>
      <ThemeFonts page={page} />
      {page.sections
        .filter((s) => ctx.editor || !s.hidden)
        .map((s) => (
          <SectionView key={s.id} s={s} ctx={ctx} />
        ))}
    </div>
  );
}

/** Wraps non-CMS pages (search, property) with the CMS-managed header, footer and theme. */
export function SiteShell({ page, contact, children }: { page: Page; contact?: ContactConfig; children: ReactNode }) {
  const header = page.sections.find((s) => s.type === "header" && !s.hidden);
  const footer = page.sections.find((s) => s.type === "footer" && !s.hidden);
  const ctx: RenderCtx = { properties: [], cityCounts: {}, contact };
  return (
    <div className="site" style={themeCss(page.theme)}>
      <ThemeFonts page={page} />
      {header && <HeaderSection s={header} ctx={ctx} />}
      <main>{children}</main>
      {footer && <FooterSection s={footer} ctx={ctx} />}
    </div>
  );
}

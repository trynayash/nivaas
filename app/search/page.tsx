import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/cms/PageRenderer";
import { PropertyCard } from "@/components/PropertyCard";
import { SearchBar } from "@/components/SearchBar";
import { FiltersPanel, SortSelect } from "@/components/search/FiltersPanel";
import { Icon } from "@/components/Icon";
import { getPublishedPage } from "@/lib/cms/store";
import { getCity } from "@/lib/locations";
import { getAllProperties } from "@/lib/properties";
import { Filters, closeMatches, computeFacets, describeFilters, filtersFromParams, filtersToParams, priceLabel, search } from "@/lib/search";
import { toSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { filters } = filtersFromParams(await searchParams);
  return { title: describeFilters(filters) };
}

/** Chips showing each active filter, each one removable. */
function activeChips(f: Filters): { label: string; patch: Partial<Filters> }[] {
  const out: { label: string; patch: Partial<Filters> }[] = [];
  const city = getCity(f.city);
  if (city) out.push({ label: city.name, patch: { city: undefined, localities: [], areas: [] } });
  for (const l of city?.localities ?? []) {
    if (f.localities.includes(l.slug)) out.push({ label: l.name, patch: { localities: f.localities.filter((x) => x !== l.slug), areas: f.areas.filter((a) => !l.areas.some((x) => x.slug === a)) } });
    for (const a of l.areas) if (f.areas.includes(a.slug)) out.push({ label: a.name, patch: { areas: f.areas.filter((x) => x !== a.slug) } });
  }
  for (const b of f.bhk) out.push({ label: b === 0 ? "Plot" : `${b} BHK`, patch: { bhk: f.bhk.filter((x) => x !== b) } });
  const pl = priceLabel(f.minPrice, f.maxPrice);
  if (pl) out.push({ label: pl.charAt(0).toUpperCase() + pl.slice(1), patch: { minPrice: undefined, maxPrice: undefined } });
  for (const t of f.types) out.push({ label: t, patch: { types: f.types.filter((x) => x !== t) } });
  if (f.status) out.push({ label: f.status, patch: { status: undefined } });
  for (const x of f.furnishing) out.push({ label: x, patch: { furnishing: f.furnishing.filter((y) => y !== x) } });
  if (f.minArea || f.maxArea) out.push({ label: `${f.minArea ?? 0}–${f.maxArea ?? "∞"} sq.ft`, patch: { minArea: undefined, maxArea: undefined } });
  for (const a of f.amenities) out.push({ label: a, patch: { amenities: f.amenities.filter((x) => x !== a) } });
  return out;
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { filters, parsed } = filtersFromParams(sp);
  const unmatched = (typeof sp.um === "string" ? sp.um : undefined) ?? parsed?.unmatched;
  const all = getAllProperties();
  const { total, results, page, pages, allMatched } = search(all, filters);
  const facets = computeFacets(all, filters);
  const close = closeMatches(all, filters, new Set(allMatched.map((p) => p.id)), results.length ? 6 : 9);
  const ctxParams = filtersToParams({ ...filters, page: 1 }).toString();
  const title = describeFilters(filters);
  const chips = activeChips(filters);
  const pageHref = (n: number) => `/search?${filtersToParams({ ...filters, page: n }, { page: true }).toString()}`;
  const site = await getPublishedPage();

  return (
    <SiteShell page={site}>
      <div className="search-top">
        <div className="container">
          <SearchBar key={filters.q ?? ""} initial={filters.q ?? ""} size="md" showInterpretation={false} />
        </div>
      </div>
      <div className="container search-layout">
        <aside className="search-aside">
          <FiltersPanel filters={filters} facets={facets} />
        </aside>
        <section className="results" aria-labelledby="results-title">
          <div className="results-head">
            <div>
              <h1 id="results-title">{title}</h1>
              <p className="muted">
                {total} {total === 1 ? "property" : "properties"} found
              </p>
            </div>
            <SortSelect filters={filters} />
          </div>

          {unmatched && (
            <p className="notice">
              <Icon name="info" size={16} /> We couldn’t match “{unmatched}” to a location or filter, so it was ignored.
            </p>
          )}

          {chips.length > 0 && (
            <div className="active-chips">
              {chips.map((c) => (
                <Link key={c.label} className="chip chip-sm is-on" href={`/search?${filtersToParams({ ...filters, ...c.patch, page: 1 }).toString()}`} aria-label={`Remove filter ${c.label}`}>
                  {c.label} <Icon name="x" size={13} />
                </Link>
              ))}
              <Link className="link-btn" href="/search?f=1">
                Clear all
              </Link>
            </div>
          )}

          {results.length > 0 ? (
            <div className="result-list">
              {results.map((p) => (
                <PropertyCard key={p.id} p={toSummary(p)} variant="row" href={`/property/${p.slug}?${ctxParams}`} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>No exact matches</h2>
              <p className="muted">Try removing a filter{close.length ? ", or look at the closest homes below" : ""}.</p>
            </div>
          )}

          {pages > 1 && (
            <nav className="pager" aria-label="Pagination">
              {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link key={n} href={pageHref(n)} className={n === page ? "is-current" : undefined} aria-current={n === page ? "page" : undefined}>
                  {n}
                </Link>
              ))}
              {page < pages && <Link href={pageHref(page + 1)}>Next →</Link>}
            </nav>
          )}

          {close.length > 0 && (
            <section className="close-matches" aria-labelledby="close-title">
              <div className="close-head">
                <span className="kicker">
                  <Icon name="spark" size={15} /> Matching properties
                </span>
                <h2 id="close-title">{results.length ? "Close matches you might also like" : "The closest homes to your search"}</h2>
                <p className="muted">These miss one or two of your criteria — a nearby locality, one bedroom more or less, or slightly over budget.</p>
              </div>
              <div className="grid-cards">
                {close.map((c) => (
                  <PropertyCard key={c.property.id} p={toSummary(c.property)} reasons={c.reasons} href={`/property/${c.property.slug}?${ctxParams}`} />
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </SiteShell>
  );
}

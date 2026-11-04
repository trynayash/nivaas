// Search: query parsing, URL <-> filters, filtering, facets, sorting and "close match" suggestions.
// Pure module — safe to import from both server and client components.
import { CITIES, FLAT_LOCATIONS, FlatLocation, distanceKm, findLocalityAnywhere, getCity, norm } from "./locations";
import { CRORE, LAKH, formatPrice } from "./format";
import { FURNISHINGS, Furnishing, PROPERTY_TYPES, Property, PropertyType, Status } from "./types";

export type SortKey = "relevance" | "price-asc" | "price-desc" | "newest" | "area-desc" | "ppsf-asc";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "newest", label: "Newest first" },
  { key: "area-desc", label: "Largest area" },
  { key: "ppsf-asc", label: "Best price / sq.ft" },
];

export interface Filters {
  q?: string;
  city?: string;
  localities: string[];
  areas: string[];
  bhk: number[];
  minPrice?: number;
  maxPrice?: number;
  types: PropertyType[];
  status?: Status;
  furnishing: Furnishing[];
  minArea?: number;
  maxArea?: number;
  amenities: string[];
  sort: SortKey;
  page: number;
}

export const emptyFilters = (): Filters => ({
  localities: [],
  areas: [],
  bhk: [],
  types: [],
  furnishing: [],
  amenities: [],
  sort: "relevance",
  page: 1,
});

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

export interface ParsedQuery {
  city?: string;
  localities: string[];
  areas: string[];
  bhk: number[];
  minPrice?: number;
  maxPrice?: number;
  types: PropertyType[];
  status?: Status;
  furnishing: Furnishing[];
  /** Words we could not interpret (shown to the user). */
  unmatched?: string;
  /** Location nodes recognised in the query. */
  matchedLocations: FlatLocation[];
}

/** Highest BHK a listing can have (matches the Studio form). */
export const MAX_BHK = 10;

const UNIT = "(cr|crore|crores|c|l|lac|lacs|lakh|lakhs|k)";
const NUM = "(\\d+(?:\\.\\d+)?)";

function toRupees(nStr: string, unit?: string): number {
  const n = parseFloat(nStr);
  const u = (unit ?? "").toLowerCase();
  if (u.startsWith("c")) return Math.round(n * CRORE);
  if (u.startsWith("l")) return Math.round(n * LAKH);
  if (u === "k") return Math.round(n * 1000);
  // No unit: small numbers are crores ("under 2"), larger are lakhs ("under 80").
  if (n <= 20) return Math.round(n * CRORE);
  if (n < 10000) return Math.round(n * LAKH);
  return Math.round(n);
}

const TYPE_WORDS: [RegExp, PropertyType][] = [
  [/\brow ?houses?\b/, "Row House"],
  [/\bpent ?house(s)?\b/, "Penthouse"],
  [/\bvillas?\b/, "Villa"],
  [/\b(independent (house|home)s?|bungalows?|kothi)\b/, "Independent House"],
  [/\b(apartments?|flats?|condos?)\b/, "Apartment"],
  [/\b(plots?|land)\b/, "Plot"],
];

const STOPWORDS = new Set(
  (
    "in at near around nearby within of for the a an to on with and or & , show me find search looking look buy sale " +
    "property properties home homes house houses residential new resale budget price rs inr best good cheap luxury " +
    // Hinglish
    "mein mai me ka ki ke wala wali wale chahiye chaiye dikhao batao ghar makaan flat " +
    // price/BHK keywords left behind once their number has been read elsewhere
    "above over below under max min maximum minimum within upto up than more less starting between km kms"
  ).split(/\s+/)
);

/** Location names that exist in more than one place (e.g. "Phase 1"). These need their parent mentioned. */
const AMBIGUOUS_TERMS = (() => {
  const counts = new Map<string, number>();
  for (const l of FLAT_LOCATIONS) for (const t of l.terms) counts.set(t, (counts.get(t) ?? 0) + 1);
  return new Set([...counts].filter(([, c]) => c > 1).map(([t]) => t));
})();

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function parseQuery(input: string): ParsedQuery {
  const out: ParsedQuery = { localities: [], areas: [], bhk: [], types: [], furnishing: [], matchedLocations: [] };
  let s = ` ${input
    .toLowerCase()
    .replace(/\d{1,3}(?:,\d{2,3})+/g, (m) => m.replace(/,/g, ""))
    .replace(/₹/g, " ")
    .replace(/\b(rs|inr)\.?(?=\s|\d)/g, " ")} `;
  const cut = (m: string) => (s = s.replace(m, " "));

  // --- Compound amounts: "2 crore 50 lakh" → "250 lakh" ------------------
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:l|lac|lacs|lakh|lakhs)\b/g,
    (_m, cr: string, l: string) => ` ${+(parseFloat(cr) * 100 + parseFloat(l)).toFixed(2)} lakh `
  );

  // --- BHK first, so its number is never mistaken for a price ("budget 2 bhk") ---
  const BHK_WORD = "(?:bhk|bhks|bed|beds|bedroom|bedrooms|br)";
  const span = new RegExp(`\\b(\\d{1,2})\\s*(?:-|to)\\s*(\\d{1,2})\\s*${BHK_WORD}\\b`).exec(s);
  if (span) {
    const [a, b] = [+span[1], +span[2]].sort((x, y) => x - y);
    for (let i = a; i <= b; i++) out.bhk.push(i);
    cut(span[0]);
  }
  const multi = new RegExp(`\\b(\\d{1,2})\\s*(?:,|/|or|and|&)\\s*(\\d{1,2})\\s*-?\\s*${BHK_WORD}\\b`).exec(s);
  if (multi) {
    out.bhk.push(+multi[1], +multi[2]);
    cut(multi[0]);
  }
  const bhkRe = new RegExp(`\\b(\\d{1,2})\\s*(\\+)?\\s*-?\\s*${BHK_WORD}\\b`, "g");
  let m: RegExpExecArray | null;
  const bhkHits: string[] = [];
  while ((m = bhkRe.exec(s))) {
    const n = +m[1];
    if (m[2]) for (let i = n; i <= MAX_BHK; i++) out.bhk.push(i);
    else out.bhk.push(n);
    bhkHits.push(m[0]);
  }
  bhkHits.forEach(cut);
  if (/\b(studio|1 ?rk)\b/.test(s)) {
    out.bhk.push(1);
    s = s.replace(/\b(studio|1 ?rk)\b/, " ");
  }
  out.bhk = [...new Set(out.bhk)].filter((b) => b >= 1 && b <= MAX_BHK).sort((a, b) => a - b);

  // --- Price -------------------------------------------------------------
  // A number followed by a non-price unit ("5 km", "3 floors") is never a budget.
  const NOT_PRICE = "(?!\\s*(?:km|kms|kilomet|m\\b|min|mins|minutes|floor|floors|sq|sqft|acre|acres|year|years|yr|yrs|%))";
  const range = new RegExp(`(?:between\\s+|from\\s+)?${NUM}\\s*${UNIT}?\\s*(?:-|to|and)\\s*${NUM}\\s*${UNIT}\\b`).exec(s);
  if (range) {
    const hiUnit = range[4];
    let lo = toRupees(range[1], range[2] ?? hiUnit);
    // "80 to 1.2 cr": a unit-less low end larger than the high end means lakhs, not crores.
    if (!range[2] && lo > toRupees(range[3], hiUnit)) lo = toRupees(range[1], "lakh");
    out.minPrice = lo;
    out.maxPrice = toRupees(range[3], hiUnit);
    cut(range[0]);
  }
  const max = new RegExp(`(?:^|\\s)(under|below|less than|upto|up to|within|max|maximum|budget|<)\\s*(?:of\\s*)?${NUM}\\s*${UNIT}?\\b${NOT_PRICE}`).exec(s);
  if (max) {
    out.maxPrice = toRupees(max[2], max[3]);
    cut(max[0]);
  }
  const min = new RegExp(`(?:^|\\s)(above|over|more than|min|minimum|from|starting|>)\\s*(?:at\\s*)?${NUM}\\s*${UNIT}?\\b${NOT_PRICE}`).exec(s);
  if (min) {
    out.minPrice = toRupees(min[2], min[3]);
    cut(min[0]);
  }
  // A plain amount with a unit ("2 bhk 85 lakhs", "1.5cr") is read as the budget.
  if (out.maxPrice === undefined) {
    const bare = new RegExp(`(?:^|\\s)${NUM}\\s*(cr|crore|crores|l|lac|lacs|lakh|lakhs)\\b`).exec(s);
    if (bare) {
      out.maxPrice = toRupees(bare[1], bare[2]);
      cut(bare[0]);
    }
  }
  if (out.minPrice !== undefined && out.maxPrice !== undefined && out.minPrice > out.maxPrice) {
    [out.minPrice, out.maxPrice] = [out.maxPrice, out.minPrice];
  }

  // --- Status / furnishing -----------------------------------------------
  if (/\b(ready to move|ready-to-move|ready|rtm)\b/.test(s)) {
    out.status = "Ready to Move";
    s = s.replace(/\b(ready to move|ready-to-move|ready|rtm)\b/, " ");
  } else if (/\b(under construction|new launch|upcoming|pre launch)\b/.test(s)) {
    out.status = "Under Construction";
    s = s.replace(/\b(under construction|new launch|upcoming|pre launch)\b/, " ");
  }
  if (/\bsemi[ -]?furnished\b/.test(s)) {
    out.furnishing.push("Semi-Furnished");
    s = s.replace(/\bsemi[ -]?furnished\b/, " ");
  } else if (/\bunfurnished\b/.test(s)) {
    out.furnishing.push("Unfurnished");
    s = s.replace(/\bunfurnished\b/, " ");
  } else if (/\b(fully )?furnished\b/.test(s)) {
    out.furnishing.push("Fully Furnished");
    s = s.replace(/\b(fully )?furnished\b/, " ");
  }

  // --- Property type -----------------------------------------------------
  for (const [re, t] of TYPE_WORDS) {
    if (re.test(s)) {
      out.types.push(t);
      s = s.replace(re, " ");
    }
  }

  // --- Location ----------------------------------------------------------
  let n = ` ${norm(s)} `;
  const candidates: { loc: FlatLocation; term: string }[] = [];
  for (const loc of FLAT_LOCATIONS) {
    for (const term of loc.terms) {
      if (term && n.includes(` ${term} `)) candidates.push({ loc, term });
    }
  }
  // Longest terms first so "murud janjira" wins over "murud".
  candidates.sort((a, b) => b.term.length - a.term.length);
  const chosen: { loc: FlatLocation; term: string }[] = [];
  for (const c of candidates) {
    if (chosen.some((x) => x.loc === c.loc)) continue;
    chosen.push(c);
  }
  for (const c of chosen) n = n.replace(` ${c.term} `, " ");

  // Fuzzy matching for typos ("banglor", "whitefeild") on leftover words.
  const leftover = n.split(/\s+/).filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  const unmatched: string[] = [];
  for (let i = 0; i < leftover.length; i++) {
    const w = leftover[i];
    const bigram = i + 1 < leftover.length ? `${w} ${leftover[i + 1]}` : null;
    let best: { loc: FlatLocation; term: string; d: number; usedBigram: boolean } | null = null;
    for (const loc of FLAT_LOCATIONS) {
      for (const term of loc.terms) {
        if (AMBIGUOUS_TERMS.has(term)) continue;
        for (const [cand, usedBigram] of [[w, false], [bigram, true]] as const) {
          if (!cand || cand.length < 4) continue;
          const tol = cand.length >= 7 ? 2 : 1;
          if (Math.abs(cand.length - term.length) > tol) continue;
          const d = levenshtein(cand, term);
          if (d <= tol && (!best || d < best.d)) best = { loc, term, d, usedBigram };
        }
      }
    }
    if (best) {
      if (!chosen.some((x) => x.loc === best!.loc)) chosen.push({ loc: best.loc, term: best.term });
      if (best.usedBigram) i++;
    } else {
      unmatched.push(w);
    }
  }

  // Resolve hierarchy: drop ambiguous area names unless their parent was mentioned.
  const mentionedCities = new Set(chosen.filter((c) => c.loc.level === "city").map((c) => c.loc.city));
  const mentionedLocs = new Set(chosen.filter((c) => c.loc.level === "locality").map((c) => c.loc.locality));
  const resolved = chosen.filter((c) => {
    if (!AMBIGUOUS_TERMS.has(c.term)) return true;
    if (c.loc.level === "area") return mentionedLocs.has(c.loc.locality);
    return mentionedCities.has(c.loc.city);
  });

  // Prefer one city; when several cities are mentioned, use the first that has the most specific match.
  const byCity = new Map<string, FlatLocation[]>();
  for (const c of resolved) byCity.set(c.loc.city, [...(byCity.get(c.loc.city) ?? []), c.loc]);
  const cityEntry = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (cityEntry) {
    const [citySlug, locs] = cityEntry;
    out.city = citySlug;
    const areaLocs = locs.filter((l) => l.level === "area");
    const locLocs = locs.filter((l) => l.level === "locality");
    out.areas = [...new Set(areaLocs.map((l) => l.area!))];
    // Localities: those explicitly mentioned that are not just parents of mentioned areas.
    const areaParents = new Set(areaLocs.map((l) => l.locality!));
    out.localities = [...new Set(locLocs.map((l) => l.locality!).filter((l) => !areaParents.has(l)))];
    // Keep the parents too so the hierarchy is complete (area ⊂ locality).
    out.localities = [...new Set([...out.localities, ...areaParents])];
    out.matchedLocations = locs;
  }

  if (unmatched.length) out.unmatched = unmatched.join(" ");
  return out;
}

// ---------------------------------------------------------------------------
// URL <-> Filters
// ---------------------------------------------------------------------------

type SP = Record<string, string | string[] | undefined>;
const STRUCTURED_KEYS = ["f", "city", "loc", "area", "bhk", "min", "max", "type", "status", "furn", "amin", "amax", "am"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Comma-separated and/or repeated params (?bhk=2&bhk=3), de-duplicated. */
const list = (v: string | string[] | undefined) => [
  ...new Set(
    (Array.isArray(v) ? v : [v ?? ""])
      .join(",")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  ),
];
const num = (v: string | string[] | undefined) => {
  const x = first(v);
  if (!x) return undefined;
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function spFromURLSearchParams(u: URLSearchParams): SP {
  const o: SP = {};
  u.forEach((v, k) => (o[k] = v));
  return o;
}

/**
 * Structured params are authoritative. If none are present, the free-text query (q) is parsed.
 * Note: no price filter is ever applied unless the user asks for one.
 */
export function filtersFromParams(sp: SP): { filters: Filters; parsed?: ParsedQuery } {
  const f = emptyFilters();
  f.q = first(sp.q)?.trim() || undefined;
  const sort = first(sp.sort) as SortKey | undefined;
  if (sort && SORTS.some((s) => s.key === sort)) f.sort = sort;
  f.page = Math.max(1, Math.floor(num(sp.page) ?? 1));

  const structured = STRUCTURED_KEYS.some((k) => sp[k] !== undefined);
  if (!structured && f.q) {
    const parsed = parseQuery(f.q);
    Object.assign(f, {
      city: parsed.city,
      localities: parsed.localities,
      areas: parsed.areas,
      bhk: parsed.bhk,
      minPrice: parsed.minPrice,
      maxPrice: parsed.maxPrice,
      types: parsed.types,
      status: parsed.status,
      furnishing: parsed.furnishing,
    });
    return { filters: f, parsed };
  }

  f.city = getCity(first(sp.city)) ? first(sp.city) : undefined;
  f.localities = list(sp.loc);
  f.areas = list(sp.area);
  // A locality without a city (hand-edited or old link): use the locality's own city.
  if (!f.city && f.localities.length) f.city = findLocalityAnywhere(f.localities[0])?.city.slug;
  if (f.city) {
    const city = getCity(f.city)!;
    f.localities = f.localities.filter((l) => city.localities.some((x) => x.slug === l));
    f.areas = f.areas.filter((a) => city.localities.some((l) => l.areas.some((x) => x.slug === a)));
  }
  f.bhk = list(sp.bhk)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_BHK)
    .sort((a, b) => a - b);
  f.minPrice = num(sp.min);
  f.maxPrice = num(sp.max);
  if (f.minPrice && f.maxPrice && f.minPrice > f.maxPrice) [f.minPrice, f.maxPrice] = [f.maxPrice, f.minPrice];
  f.types = list(sp.type).filter((t): t is PropertyType => (PROPERTY_TYPES as string[]).includes(t));
  const st = first(sp.status);
  f.status = st === "ready" ? "Ready to Move" : st === "uc" ? "Under Construction" : undefined;
  f.furnishing = list(sp.furn).filter((x): x is Furnishing => (FURNISHINGS as string[]).includes(x));
  f.minArea = num(sp.amin);
  f.maxArea = num(sp.amax);
  f.amenities = list(sp.am);
  return { filters: f };
}

export function filtersToParams(f: Filters, opts: { page?: boolean } = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  p.set("f", "1");
  if (f.city) p.set("city", f.city);
  if (f.localities.length) p.set("loc", f.localities.join(","));
  if (f.areas.length) p.set("area", f.areas.join(","));
  if (f.bhk.length) p.set("bhk", f.bhk.join(","));
  if (f.minPrice) p.set("min", String(f.minPrice));
  if (f.maxPrice) p.set("max", String(f.maxPrice));
  if (f.types.length) p.set("type", f.types.join(","));
  if (f.status) p.set("status", f.status === "Ready to Move" ? "ready" : "uc");
  if (f.furnishing.length) p.set("furn", f.furnishing.join(","));
  if (f.minArea) p.set("amin", String(f.minArea));
  if (f.maxArea) p.set("amax", String(f.maxArea));
  if (f.amenities.length) p.set("am", f.amenities.join(","));
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (opts.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

/** Convert a free-text query into structured search params (used by the search bar). */
export function queryToParams(q: string): URLSearchParams {
  const parsed = parseQuery(q);
  const f: Filters = {
    ...emptyFilters(),
    q: q.trim() || undefined,
    city: parsed.city,
    localities: parsed.localities,
    areas: parsed.areas,
    bhk: parsed.bhk,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    types: parsed.types,
    status: parsed.status,
    furnishing: parsed.furnishing,
  };
  return filtersToParams(f);
}

// ---------------------------------------------------------------------------
// Filtering, facets, sorting
// ---------------------------------------------------------------------------

export type FacetKey = "location" | "bhk" | "price" | "type" | "status" | "furnishing" | "area" | "amenities";

export function matches(p: Property, f: Filters, skip?: FacetKey): boolean {
  if (skip !== "location") {
    if (f.city && p.location.city !== f.city) return false;
    if (f.areas.length) {
      // An area selection narrows its own locality; other selected localities still match entirely.
      const areaLocalities = new Set(
        FLAT_LOCATIONS.filter((l) => l.level === "area" && l.city === p.location.city && f.areas.includes(l.area!)).map((l) => l.locality)
      );
      const inArea = f.areas.includes(p.location.area);
      const inOtherLocality = f.localities.includes(p.location.locality) && !areaLocalities.has(p.location.locality);
      if (!inArea && !inOtherLocality) return false;
    } else if (f.localities.length && !f.localities.includes(p.location.locality)) return false;
  }
  if (skip !== "bhk" && f.bhk.length && !f.bhk.includes(p.bhk)) return false;
  if (skip !== "price") {
    if (f.minPrice && p.price < f.minPrice) return false;
    if (f.maxPrice && p.price > f.maxPrice) return false;
  }
  if (skip !== "type" && f.types.length && !f.types.includes(p.type)) return false;
  if (skip !== "status" && f.status && p.status !== f.status) return false;
  if (skip !== "furnishing" && f.furnishing.length && !f.furnishing.includes(p.furnishing)) return false;
  if (skip !== "area") {
    if (f.minArea && p.superBuiltUpArea < f.minArea) return false;
    if (f.maxArea && p.superBuiltUpArea > f.maxArea) return false;
  }
  if (skip !== "amenities" && f.amenities.length && !f.amenities.every((a) => p.amenities.includes(a))) return false;
  return true;
}

export function sortProperties(list: Property[], sort: SortKey, f?: Filters): Property[] {
  const out = [...list];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => a.price - b.price);
    case "price-desc":
      return out.sort((a, b) => b.price - a.price);
    case "newest":
      return out.sort((a, b) => b.postedOn.localeCompare(a.postedOn));
    case "area-desc":
      return out.sort((a, b) => b.superBuiltUpArea - a.superBuiltUpArea);
    case "ppsf-asc":
      return out.sort((a, b) => a.price / a.superBuiltUpArea - b.price / b.superBuiltUpArea);
    default: {
      // Relevance: exact area hits, then featured, then RERA-verified, then newest.
      const score = (p: Property) =>
        (f?.areas.includes(p.location.area) ? 4 : 0) + (p.featured ? 2 : 0) + (p.rera.applicable ? 1 : 0);
      return out.sort((a, b) => score(b) - score(a) || b.postedOn.localeCompare(a.postedOn));
    }
  }
}

export interface Facets {
  bhk: Record<string, number>;
  types: Record<string, number>;
  localities: { slug: string; name: string; count: number; areas: { slug: string; name: string; count: number }[] }[];
  cities: { slug: string; name: string; count: number }[];
  status: Record<string, number>;
  furnishing: Record<string, number>;
}

export function computeFacets(all: Property[], f: Filters): Facets {
  const count = <K extends string | number>(key: FacetKey, get: (p: Property) => K) => {
    const out: Record<string, number> = {};
    for (const p of all) if (matches(p, f, key)) out[String(get(p))] = (out[String(get(p))] ?? 0) + 1;
    return out;
  };
  const locPool = all.filter((p) => matches(p, { ...f, localities: [], areas: [] }, undefined));
  const city = getCity(f.city);
  const cityPool = all.filter((p) => matches(p, f, "location"));
  return {
    bhk: count("bhk", (p) => p.bhk),
    types: count("type", (p) => p.type),
    status: count("status", (p) => p.status),
    furnishing: count("furnishing", (p) => p.furnishing),
    cities: CITIES.map((c) => ({ slug: c.slug, name: c.name, count: cityPool.filter((p) => p.location.city === c.slug).length })),
    localities: city
      ? city.localities.map((l) => ({
          slug: l.slug,
          name: l.name,
          count: locPool.filter((p) => p.location.locality === l.slug).length,
          areas: l.areas.map((a) => ({ slug: a.slug, name: a.name, count: locPool.filter((p) => p.location.area === a.slug).length })),
        }))
      : [],
  };
}

export const PAGE_SIZE = 12;

export function search(all: Property[], f: Filters) {
  const matched = sortProperties(
    all.filter((p) => matches(p, f)),
    f.sort,
    f
  );
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return {
    total: matched.length,
    page,
    pages,
    results: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    allMatched: matched,
  };
}

// ---------------------------------------------------------------------------
// Human description of the search
// ---------------------------------------------------------------------------

export function locationLabel(f: Pick<Filters, "city" | "localities" | "areas">): string | undefined {
  const city = getCity(f.city);
  if (!city) return undefined;
  const parts: string[] = [];
  const areaNodes = city.localities.flatMap((l) => l.areas.filter((a) => f.areas.includes(a.slug)).map((a) => ({ a, l })));
  const areaLocs = new Set(areaNodes.map((x) => x.l.slug));
  for (const { a, l } of areaNodes) parts.push(`${a.name}, ${l.name}`);
  for (const l of city.localities) if (f.localities.includes(l.slug) && !areaLocs.has(l.slug)) parts.push(l.name);
  if (!parts.length) return city.name;
  return `${parts.join(" / ")}, ${city.name}`;
}

const plural = (t: PropertyType) =>
  t === "Independent House" ? "Independent Houses" : t === "Row House" ? "Row Houses" : t === "Penthouse" ? "Penthouses" : `${t}s`;

export function priceLabel(min?: number, max?: number) {
  if (min && max) return `${formatPrice(min)} – ${formatPrice(max)}`;
  if (max) return `under ${formatPrice(max)}`;
  if (min) return `above ${formatPrice(min)}`;
  return undefined;
}

export function describeFilters(f: Filters): string {
  const rooms = f.bhk.filter((b) => b > 0);
  const plotsOnly = f.bhk.length > 0 && rooms.length === 0;
  const bhk = rooms.length ? `${rooms.join(", ")} BHK ` : "";
  const what = f.types.length ? f.types.map(plural).join(" & ") : plotsOnly ? "Plots" : rooms.length ? "homes" : "Properties";
  const where = locationLabel(f);
  const price = priceLabel(f.minPrice, f.maxPrice);
  const text = `${bhk}${what}${where ? ` in ${where}` : ""}${price ? ` ${price}` : ""}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function hasAnyCriteria(f: Filters) {
  return !!(
    f.city ||
    f.localities.length ||
    f.areas.length ||
    f.bhk.length ||
    f.minPrice ||
    f.maxPrice ||
    f.types.length ||
    f.status ||
    f.furnishing.length ||
    f.minArea ||
    f.maxArea ||
    f.amenities.length
  );
}

// ---------------------------------------------------------------------------
// Close matches for the search results page ("matching properties")
// ---------------------------------------------------------------------------

export interface CloseMatch {
  property: Property;
  reasons: string[];
  score: number;
}

function referencePoints(f: Filters) {
  const city = getCity(f.city);
  if (!city) return [];
  if (f.areas.length)
    return city.localities.flatMap((l) => l.areas.filter((a) => f.areas.includes(a.slug)).map((a) => ({ ...a, label: a.name })));
  if (f.localities.length) return city.localities.filter((l) => f.localities.includes(l.slug)).map((l) => ({ ...l, label: l.name }));
  return [];
}

/**
 * Homes that miss the search by a small margin (nearby locality, ±1 BHK, slightly over budget…).
 * Shown below the results so users always see relevant alternatives.
 */
export function closeMatches(all: Property[], f: Filters, excludeIds: Set<string>, limit = 6): CloseMatch[] {
  if (!hasAnyCriteria(f)) return [];
  const refs = referencePoints(f);
  const out: CloseMatch[] = [];
  for (const p of all) {
    if (excludeIds.has(p.id)) continue;
    if (f.city && p.location.city !== f.city) continue;
    if (f.types.length && !f.types.includes(p.type)) continue;
    const reasons: string[] = [];
    let score = 100;
    let misses = 0;

    // Location
    if (refs.length && !matches(p, { ...emptyFilters(), city: f.city, localities: f.localities, areas: f.areas })) {
      const nearest = refs
        .map((r) => ({ r, d: distanceKm(r, p.location) }))
        .sort((a, b) => a.d - b.d)[0];
      const sameLocality = f.localities.includes(p.location.locality);
      if (!sameLocality && nearest.d > 9) continue;
      misses++;
      score -= sameLocality ? 8 : 10 + nearest.d * 2;
      reasons.push(sameLocality ? `Elsewhere in ${p.location.localityName}` : `Nearby · ${nearest.d.toFixed(1)} km from ${nearest.r.label}`);
    }
    // Configuration
    if (f.bhk.length && !f.bhk.includes(p.bhk)) {
      const diff = Math.min(...f.bhk.map((b) => Math.abs(b - p.bhk)));
      if (diff > 1 || p.bhk === 0) continue;
      misses++;
      score -= 18;
      reasons.push(p.bhk > Math.max(...f.bhk) ? `${p.bhk} BHK · one more bedroom` : `${p.bhk} BHK · one bedroom less`);
    }
    // Price
    if (f.maxPrice && p.price > f.maxPrice) {
      const over = (p.price - f.maxPrice) / f.maxPrice;
      if (over > 0.2) continue;
      misses++;
      score -= 10 + over * 100;
      reasons.push(`Just above budget (+${Math.round(over * 100)}%)`);
    }
    if (f.minPrice && p.price < f.minPrice) {
      const under = (f.minPrice - p.price) / f.minPrice;
      if (under > 0.25) continue;
      misses++;
      score -= 8 + under * 60;
      reasons.push(`Below your minimum (−${Math.round(under * 100)}%)`);
    }
    // Secondary preferences
    const secondary = [
      f.status && p.status !== f.status ? p.status : null,
      f.furnishing.length && !f.furnishing.includes(p.furnishing) ? p.furnishing : null,
      f.amenities.length && !f.amenities.every((a) => p.amenities.includes(a)) ? "Fewer of your amenities" : null,
      (f.minArea && p.superBuiltUpArea < f.minArea) || (f.maxArea && p.superBuiltUpArea > f.maxArea) ? "Different size" : null,
    ].filter(Boolean) as string[];
    if (secondary.length) {
      misses += secondary.length;
      score -= 12 * secondary.length;
      reasons.push(...secondary);
    }
    if (misses === 0 || misses > 2) continue;
    out.push({ property: p, reasons, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

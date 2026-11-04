import { parseQuery, filtersFromParams, search, closeMatches, describeFilters } from "../lib/search";
import { generateProperties } from "../lib/seed";
import { recommend } from "../lib/recommend";
import { formatPrice } from "../lib/format";

const all = generateProperties();
console.log("total", all.length);
const qs = [
  "property in Bangalore",
  "2BHK in Bangalore",
  "3 bhk in bengaluru under 1 crore",
  "4BHK in Whitefield Bangalore",
  "3BHK in Madhli Aai, Murud Janjira",
  "Bangalore mein 2BHK chahiye",
  "villas in murud under 2 cr",
  "2,3 bhk in hsr layout 80 lakh to 1.5 cr",
  "3bhk banglore whitefeild",
  "ready to move flats in powai",
  "phase 1 electronic city 2bhk",
  "4bhk in koramangala xyzzy",
];
for (const q of qs) {
  const { filters } = filtersFromParams({ q });
  const r = search(all, filters);
  const pq = parseQuery(q);
  const cm = closeMatches(all, filters, new Set(r.allMatched.map((p) => p.id)));
  console.log(`\n"${q}" → ${describeFilters(filters)} | ${r.total} results | close ${cm.length} | unmatched=${pq.unmatched ?? "-"}`);
  console.log("  ", JSON.stringify({ city: filters.city, loc: filters.localities, area: filters.areas, bhk: filters.bhk, min: filters.minPrice, max: filters.maxPrice, types: filters.types }));
  cm.slice(0, 2).forEach((c) => console.log("   ~", c.property.title, formatPrice(c.property.price), c.reasons.join("; ")));
}
const base = all.find((p) => p.location.locality === "madhli-aai" && p.bhk === 3)!;
console.log("\nBASE", base.title, formatPrice(base.price));
for (const r of recommend(base, all, filtersFromParams({ q: "3BHK in Madhli Aai, Murud Janjira" }).filters))
  console.log("  ", r.score, r.property.title, formatPrice(r.property.price), r.reasons.join(" | "));

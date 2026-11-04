import "server-only";
import { CITIES } from "./locations";
import { getAllProperties } from "./properties";
import { toSummary, type PropertySummary } from "./types";

/** Data the CMS sections need: a pool of listings covering every "featured" source, and city counts. */
export function landingContext(): { properties: PropertySummary[]; cityCounts: Record<string, number> } {
  const all = getAllProperties();
  const pool = new Map<string, PropertySummary>();
  const add = (list: typeof all) => list.slice(0, 12).forEach((p) => pool.set(p.id, toSummary(p)));
  add(all.filter((p) => p.featured));
  add([...all].sort((a, b) => b.postedOn.localeCompare(a.postedOn)));
  for (const c of CITIES) add(all.filter((p) => p.location.city === c.slug && p.featured).concat(all.filter((p) => p.location.city === c.slug && !p.featured)));
  const cityCounts = Object.fromEntries(CITIES.map((c) => [c.slug, all.filter((p) => p.location.city === c.slug).length]));
  return { properties: [...pool.values()], cityCounts };
}

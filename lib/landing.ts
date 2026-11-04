import "server-only";
import { CITIES } from "./locations";
import { getAllProperties } from "./properties";
import { toSummary, type PropertySummary } from "./types";

export interface LocalityCount {
  slug: string;
  name: string;
  count: number;
}

/** Data the CMS sections need: listings for every "featured" source, plus live city and locality counts. */
export async function landingContext(): Promise<{
  properties: PropertySummary[];
  cityCounts: Record<string, number>;
  localities: Record<string, LocalityCount[]>;
}> {
  const all = await getAllProperties();
  const pool = new Map<string, PropertySummary>();
  const add = (list: typeof all) => list.slice(0, 12).forEach((p) => pool.set(p.id, toSummary(p)));
  add(all.filter((p) => p.featured));
  add([...all].sort((a, b) => b.postedOn.localeCompare(a.postedOn)));
  for (const c of CITIES) add(all.filter((p) => p.location.city === c.slug && p.featured).concat(all.filter((p) => p.location.city === c.slug && !p.featured)));
  const cityCounts = Object.fromEntries(CITIES.map((c) => [c.slug, all.filter((p) => p.location.city === c.slug).length]));
  const localities = Object.fromEntries(
    CITIES.map((c) => [
      c.slug,
      c.localities.map((l) => ({ slug: l.slug, name: l.name, count: all.filter((p) => p.location.locality === l.slug).length })).filter((l) => l.count > 0),
    ])
  );
  return { properties: [...pool.values()], cityCounts, localities };
}

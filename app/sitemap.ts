import type { MetadataRoute } from "next";
import { getAllProperties } from "@/lib/properties";
import { CITIES } from "@/lib/locations";

export const dynamic = "force-dynamic";

/** Home, city searches and every published, non-sample listing. Needs SITE_URL for absolute links. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let listings: Awaited<ReturnType<typeof getAllProperties>> = [];
  try {
    listings = (await getAllProperties()).filter((p) => !p.isSample);
  } catch {
    listings = [];
  }
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    ...CITIES.map((c) => ({ url: `${base}/search?city=${c.slug}&f=1`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...listings.map((p) => ({ url: `${base}/property/${p.slug}`, lastModified: p.updatedAt ?? p.postedOn, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}

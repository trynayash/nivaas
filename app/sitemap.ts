import type { MetadataRoute } from "next";
import { getAllProperties } from "@/lib/properties";
import { CITIES } from "@/lib/locations";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Next writes <loc> values into the XML verbatim, so "&" in query strings must be escaped here.
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Home, city searches and every published, non-sample listing. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  let listings: Awaited<ReturnType<typeof getAllProperties>> = [];
  try {
    listings = (await getAllProperties()).filter((p) => !p.isSample);
  } catch (err) {
    console.error("[nivaas] sitemap: could not load listings:", (err as Error).message);
  }
  return [
    { url: xml(`${base}/`), changeFrequency: "daily", priority: 1 },
    ...CITIES.map((c) => ({ url: xml(`${base}/search?city=${encodeURIComponent(c.slug)}&f=1`), changeFrequency: "daily" as const, priority: 0.7 })),
    ...listings.map((p) => ({
      url: xml(`${base}/property/${encodeURIComponent(p.slug)}`),
      lastModified: p.updatedAt ?? p.postedOn,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

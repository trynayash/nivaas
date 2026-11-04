import type { MetadataRoute } from "next";

/** Search engines are kept out until ALLOW_INDEXING=true (the demo runs on sample data). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  const base = process.env.SITE_URL?.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    ...(base && { sitemap: `${base}/sitemap.xml` }),
  };
}

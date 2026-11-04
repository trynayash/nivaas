import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Search engines are kept out until ALLOW_INDEXING=true (the demo runs on sample data). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

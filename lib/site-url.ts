/** Absolute base URL (no trailing slash): SITE_URL, else Vercel's production domain, else localhost. */
export function siteUrl(): string {
  const raw =
    process.env.SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

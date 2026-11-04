import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublishToggle, RemoveSamplesButton } from "@/components/admin/listings/ListingActions";
import { StudioHeader } from "@/components/admin/StudioNav";
import { PropertyArt } from "@/components/PropertyArt";
import { isAdmin } from "@/lib/auth";
import { newEnquiryCount } from "@/lib/enquiries/count";
import { bhkLabel, formatNumber, formatPrice } from "@/lib/format";
import { listingStore } from "@/lib/listings/store";
import { CITIES } from "@/lib/locations";
import { STUDIO_FONTS_HREF } from "@/lib/cms/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Listings · Studio", robots: { index: false } };

const PAGE = 40;

export default async function ListingsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const city = sp.city ?? "";
  const show = sp.show ?? "all"; // all | live | draft | own | sample
  const page = Math.max(1, Number(sp.page) || 1);

  const [all, newEnquiries] = await Promise.all([listingStore().list({ includeDrafts: true }), newEnquiryCount()]);
  const samples = all.filter((p) => p.isSample).length;
  const filtered = all.filter((p) => {
    if (city && p.location.city !== city) return false;
    if (show === "live" && !p.published) return false;
    if (show === "draft" && p.published) return false;
    if (show === "own" && p.isSample) return false;
    if (show === "sample" && !p.isSample) return false;
    if (q) {
      const hay = `${p.id} ${p.title} ${p.projectName} ${p.developer} ${p.location.areaName} ${p.location.localityName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(city && { city }), ...(show !== "all" && { show }) });
    for (const [k, val] of Object.entries(patch)) {
      if (val) p.set(k, String(val));
      else p.delete(k);
    }
    return `/admin/listings?${p.toString()}`;
  };

  return (
    <div className="studio-page">
      <link rel="stylesheet" href={STUDIO_FONTS_HREF} precedence="default" />
      <StudioHeader active="listings" newEnquiries={newEnquiries}>
        <Link href="/admin/listings/new" className="st-btn st-btn-primary">
          + New listing
        </Link>
      </StudioHeader>
      <main className="st-page">
        <div className="st-page-head">
          <div>
            <h1>Listings</h1>
            <p className="st-hint">
              {all.length} total · {all.filter((p) => p.published).length} live · {all.length - samples} your own · {samples} sample
            </p>
          </div>
          <RemoveSamplesButton count={samples} />
        </div>
        {sp.deleted && <p className="st-flash">Listing deleted.</p>}

        <form className="st-filters" action="/admin/listings">
          <input className="st-input" type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Search title, project, ID, area…" aria-label="Search listings" />
          <select className="st-input" name="city" defaultValue={city} aria-label="City">
            <option value="">All cities</option>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="st-input" name="show" defaultValue={show} aria-label="Show">
            <option value="all">All listings</option>
            <option value="live">Live only</option>
            <option value="draft">Drafts only</option>
            <option value="own">Your own (not sample)</option>
            <option value="sample">Sample only</option>
          </select>
          <button className="st-btn" type="submit">
            Filter
          </button>
        </form>

        {rows.length === 0 ? (
          <div className="st-empty-box">
            <p>{all.length ? "No listings match these filters." : "No listings yet."}</p>
            <Link href="/admin/listings/new" className="st-btn st-btn-primary">
              Add your first listing
            </Link>
          </div>
        ) : (
          <table className="st-table">
            <thead>
              <tr>
                <th colSpan={2}>Listing</th>
                <th>Location</th>
                <th className="num">Price</th>
                <th>Size</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="st-table-thumb">
                    <PropertyArt id={p.id} type={p.type} hue={p.hue} images={p.images} plotArea={p.plotArea} className="st-thumb" />
                  </td>
                  <td>
                    <Link href={`/admin/listings/${p.id}`} className="st-table-title">
                      {p.title}
                    </Link>
                    <div className="st-hint">
                      {p.projectName} · <span className="mono">{p.id}</span> {p.isSample && <span className="st-tag">sample</span>}
                      {p.images.length ? ` · ${p.images.length} photo${p.images.length > 1 ? "s" : ""}` : " · no photos"}
                    </div>
                  </td>
                  <td>
                    {p.location.localityName}
                    <div className="st-hint">{p.location.cityName}</div>
                  </td>
                  <td className="num">{formatPrice(p.price)}</td>
                  <td>
                    {bhkLabel(p.bhk, p.type)}
                    <div className="st-hint">{formatNumber(p.superBuiltUpArea)} sq.ft</div>
                  </td>
                  <td>
                    <PublishToggle id={p.id} published={p.published} />
                  </td>
                  <td className="st-table-actions">
                    <Link href={`/admin/listings/${p.id}`} className="st-btn st-btn-small">
                      Edit
                    </Link>
                    <a href={`/property/${p.slug}${p.published ? "" : "?preview=1"}`} target="_blank" rel="noreferrer" className="st-btn st-btn-small st-btn-ghost">
                      View ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pages > 1 && (
          <nav className="st-pager" aria-label="Pages">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={qs({ page: n })} className={n === Math.min(page, pages) ? "is-on" : undefined} aria-current={n === page ? "page" : undefined}>
                {n}
              </Link>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}

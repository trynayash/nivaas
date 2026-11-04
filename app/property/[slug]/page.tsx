import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { DEFAULT_CONTACT_MESSAGE, propertyContactMessage, waLink, whatsappFromEnv } from "@/lib/contact";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SiteShell } from "@/components/cms/PageRenderer";
import { EmiCalculator } from "@/components/EmiCalculator";
import { FloorPlan } from "@/components/FloorPlan";
import { Gallery } from "@/components/Gallery";
import { PropertyArt } from "@/components/PropertyArt";
import { PropertyCard, SampleTag } from "@/components/PropertyCard";
import { getPublishedPage } from "@/lib/cms/store";
import { isAdmin } from "@/lib/auth";
import { bhkLabel, formatNumber, formatPrice, formatSqft } from "@/lib/format";
import { getAllProperties, getPropertyBySlug } from "@/lib/properties";
import { recommend } from "@/lib/recommend";
import { describeFilters, filtersFromParams, filtersToParams, hasAnyCriteria } from "@/lib/search";
import { AMENITY_GROUPS, toSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPropertyBySlug((await params).slug);
  if (!p) return { title: "Property not found" };
  return { title: `${p.title}, ${p.location.cityName} — ${formatPrice(p.price)}`, description: p.description };
}

export default async function PropertyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  // Studio can preview unpublished listings with ?preview=1.
  const preview = sp.preview === "1" && (await isAdmin());
  const p = await getPropertyBySlug(slug, preview);
  if (!p) notFound();

  const { filters: context } = filtersFromParams(sp);
  const fromSearch = hasAnyCriteria(context) || !!context.q;
  const ctxQuery = fromSearch ? filtersToParams({ ...context, page: 1 }).toString() : "";
  const all = await getAllProperties();
  const recs = recommend(p, all, fromSearch ? context : undefined, 8);

  const isPlot = p.type === "Plot";
  const ppsf = Math.round(p.price / p.superBuiltUpArea);
  const peers = isPlot ? [] : all.filter((x) => x.location.locality === p.location.locality && x.type !== "Plot");
  const avgPpsf = peers.length > 2 ? Math.round(peers.reduce((s, x) => s + x.price / x.superBuiltUpArea, 0) / peers.length) : null;
  const vsAvg = avgPpsf ? Math.round(((ppsf - avgPpsf) / avgPpsf) * 100) : null;

  const details: [label: string, value: string][] = [
    ["Configuration", bhkLabel(p.bhk, p.type)],
    ["Property type", p.type],
    ...(isPlot
      ? ([["Plot area", formatSqft(p.plotArea ?? p.superBuiltUpArea)]] as [string, string][])
      : ([
          ["Carpet area", formatSqft(p.carpetArea)],
          ["Built-up area", formatSqft(p.builtUpArea)],
          ["Super built-up area", formatSqft(p.superBuiltUpArea)],
          ...(p.plotArea ? [["Plot area", formatSqft(p.plotArea)]] : []),
          ["Bathrooms", String(p.bathrooms)],
          ["Balconies", String(p.balconies)],
          ["Floor", p.floor !== undefined ? `${p.floor} of ${p.totalFloors}` : `${p.totalFloors} storeys`],
          ["Facing", p.facing],
          ["Furnishing", p.furnishing],
        ] as [string, string][])),
    ["Status", p.status],
    ["Possession", p.possession],
    ...(p.ageYears !== undefined ? ([["Age", p.ageYears === 0 ? "New" : `${p.ageYears} year${p.ageYears > 1 ? "s" : ""}`]] as [string, string][]) : []),
    ...(isPlot ? [] : ([["Parking", `${p.parking.covered} covered${p.parking.open ? `, ${p.parking.open} open` : ""}`]] as [string, string][])),
    ["Ownership", p.ownership],
  ];

  const specs: [string, string][] = [
    ["Project", p.projectName],
    ["Developer / seller", p.developer],
    ["Overlooking", p.overlooking.join(", ")],
    ["Flooring", p.flooring],
    ["Water supply", p.waterSupply],
    ["Power backup", p.powerBackup],
    ["Gated community", p.gatedCommunity ? "Yes" : "No"],
    ["Maintenance", p.maintenancePerMonth ? `₹${formatNumber(p.maintenancePerMonth)} / month` : "—"],
    ["Pincode", p.location.pincode],
    ["Listing ID", p.id],
    ["Listed on", new Date(p.postedOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
  ];

  const site = await getPublishedPage();
  const loc = p.location;
  // Absolute URL for the WhatsApp message (without the visitor's search context).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const pageUrl = `${proto}://${host}/property/${p.slug}`;
  const wa = whatsappFromEnv();
  // Header "List a property" keeps the selling message; the enquiry box gets the property-specific one.
  const contact = { whatsapp: wa, message: DEFAULT_CONTACT_MESSAGE };
  const propertyWhatsApp = wa ? waLink(wa, propertyContactMessage(`${p.title}, ${loc.cityName}`, formatPrice(p.price), pageUrl)) : undefined;
  const crumb = (q: string) => `/search?f=1&${q}`;

  return (
    <SiteShell page={site} contact={contact}>
      <div className="container detail">
        {!p.published && <p className="notice">Draft preview — this listing isn’t visible to visitors yet.</p>}
        <nav className="crumbs" aria-label="Breadcrumb">
          {fromSearch && (
            <Link href={`/search?${ctxQuery}`} className="text-link">
              ← Back to results
            </Link>
          )}
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href={crumb(`city=${loc.city}`)}>{loc.cityName}</Link>
            </li>
            <li>
              <Link href={crumb(`city=${loc.city}&loc=${loc.locality}`)}>{loc.localityName}</Link>
            </li>
            <li>
              <Link href={crumb(`city=${loc.city}&loc=${loc.locality}&area=${loc.area}`)}>{loc.areaName}</Link>
            </li>
          </ol>
        </nav>

        <header className="detail-head">
          <div>
            <p className="detail-kicker">
              {p.projectName} · {p.developer === "Owner (resale)" ? "resale by owner" : p.developer}
              {p.isSample && <SampleTag />}
            </p>
            <h1>{p.title}</h1>
            <p className="detail-address">{loc.address}</p>
          </div>
          <div className="detail-price">
            <strong className="num">{formatPrice(p.price)}</strong>
            <span>₹{formatNumber(ppsf)} per sq.ft</span>
          </div>
        </header>

        <div className={isPlot ? "detail-gallery is-single" : "detail-gallery"}>
          {p.images.length ? (
            <Gallery images={p.images} title={p.title} />
          ) : (
            <figure className="gal-main">
              <PropertyArt id={p.id} type={p.type} hue={p.hue} images={p.images} label={p.title} plotArea={p.plotArea} className="gal-art" />
              <figcaption>{isPlot ? "Plot sketch from listed area — not a survey" : "Drawing only — no photos yet"}</figcaption>
            </figure>
          )}
          {!isPlot && (
            <figure className="gal-plan">
              <FloorPlan bhk={p.bhk} bathrooms={p.bathrooms} balconies={p.balconies} carpetArea={p.carpetArea} />
              <figcaption>
                Indicative {bhkLabel(p.bhk)} layout, {formatSqft(p.carpetArea)} carpet — not the developer’s plan
              </figcaption>
            </figure>
          )}
        </div>

        <div className="detail-grid">
          <div className="detail-main">
            <section className="dsec" aria-labelledby="details">
              <h2 id="details">Details</h2>
              <dl className="dtable">
                {details.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="dsec" aria-labelledby="rera">
              <h2 id="rera">RERA</h2>
              <div className={`rera-box ${p.rera.applicable ? "is-ok" : "is-na"}`}>
                {p.rera.applicable ? (
                  <dl className="rera-grid">
                    <div>
                      <dt>Status</dt>
                      <dd>Registered</dd>
                    </div>
                    <div>
                      <dt>Registration number</dt>
                      <dd className="mono">{p.rera.number}</dd>
                    </div>
                    <div>
                      <dt>Authority</dt>
                      <dd>{p.rera.authority}</dd>
                    </div>
                  </dl>
                ) : (
                  <p>
                    <b>Registration not applicable.</b> {p.rera.note}
                  </p>
                )}
                {p.isSample ? (
                  <p className="rera-note">This is a sample listing. The registration number above is illustrative and is not on the {p.rera.authority} register.</p>
                ) : (
                  <a href={p.rera.website} target="_blank" rel="noopener noreferrer" className="text-link">
                    Check this on the {p.rera.authority} website ↗
                  </a>
                )}
              </div>
            </section>

            <section className="dsec" aria-labelledby="overview">
              <h2 id="overview">About this home</h2>
              <p className="lead">{p.description}</p>
              <ul className="dash-list">
                {p.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </section>

            <section className="dsec" aria-labelledby="amenities">
              <h2 id="amenities">Amenities</h2>
              <div className="amenity-groups">
                {Object.entries(AMENITY_GROUPS).map(([group, list]) => {
                  const have = list.filter((a) => p.amenities.includes(a));
                  if (!have.length) return null;
                  return (
                    <div key={group}>
                      <h3>{group}</h3>
                      <ul>
                        {have.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="dsec" aria-labelledby="specs">
              <h2 id="specs">Specifications</h2>
              <dl className="dtable dtable-2">
                {specs.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="dsec" aria-labelledby="location">
              <h2 id="location">Location</h2>
              <p className="loc-path">
                {loc.cityName} › {loc.localityName} › {loc.areaName}
              </p>
              <table className="nearby">
                <caption className="sr-only">Distances to nearby places</caption>
                <tbody>
                  {p.nearby.map((n) => (
                    <tr key={n.name}>
                      <th scope="row">{n.name}</th>
                      <td className="nearby-kind">{n.kind}</td>
                      <td className="num">{n.distanceKm} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {p.isSample && <p className="hint">Distances in sample listings are approximate.</p>}
            </section>

            <section className="dsec" aria-labelledby="loan">
              <h2 id="loan">Home loan</h2>
              <p>Approved by {p.approvedBanks.join(", ")}.</p>
            </section>
          </div>

          <aside className="detail-aside">
            <div className="price-box">
              <p className="price-box-label">Asking price</p>
              <p className="price-big num">{formatPrice(p.price)}</p>
              <p className="price-box-sub">
                ₹{formatNumber(ppsf)} per sq.ft{p.maintenancePerMonth ? ` · ₹${formatNumber(p.maintenancePerMonth)}/month maintenance` : ""}
              </p>
              {vsAvg !== null && (
                <p className="insight">
                  {vsAvg === 0 ? "In line with" : `${Math.abs(vsAvg)}% ${vsAvg < 0 ? "below" : "above"}`} the {loc.localityName} average of ₹{formatNumber(avgPpsf!)} per sq.ft
                  {p.isSample ? " (sample data)" : ""}.
                </p>
              )}
              <EmiCalculator price={p.price} />
              <a className="text-link" href="#similar">
                Similar homes ↓
              </a>
            </div>
            <div className="price-box enq-box">
              {p.published ? (
                <EnquiryForm propertyId={p.id} title={p.title} whatsappHref={propertyWhatsApp} />
              ) : (
                <p className="st-hint">The enquiry form appears here once the listing is published.</p>
              )}
            </div>
          </aside>
        </div>

        <section id="similar" className="similar" aria-labelledby="similar-title">
          <div className="sec-head">
            <div className="sec-head-text">
              <h2 id="similar-title" className="sec-title">
                Similar homes
              </h2>
              <p className="sec-sub sec-muted">
                Ranked by location, configuration and price against this {bhkLabel(p.bhk, p.type)} in {loc.areaName}
                {fromSearch && hasAnyCriteria(context) ? <>. Homes that also fit your search ({describeFilters(context)}) rank higher</> : null}.
              </p>
            </div>
          </div>
          {recs.length ? (
            <div className="grid-cards">
              {recs.map((r) => (
                <PropertyCard key={r.property.id} p={toSummary(r.property)} reasons={r.reasons} score={r.score} href={`/property/${r.property.slug}${ctxQuery ? `?${ctxQuery}` : ""}`} />
              ))}
            </div>
          ) : (
            <p className="sec-muted">No similar homes listed in {loc.cityName} right now.</p>
          )}
        </section>
      </div>
    </SiteShell>
  );
}

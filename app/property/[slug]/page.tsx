import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/cms/PageRenderer";
import { EmiCalculator } from "@/components/EmiCalculator";
import { FloorPlan } from "@/components/FloorPlan";
import { Icon } from "@/components/Icon";
import { PropertyArt } from "@/components/PropertyArt";
import { PropertyCard } from "@/components/PropertyCard";
import { getPublishedPage } from "@/lib/cms/store";
import { bhkLabel, formatNumber, formatPrice, formatSqft } from "@/lib/format";
import { getAllProperties, getPropertyBySlug } from "@/lib/properties";
import { recommend } from "@/lib/recommend";
import { describeFilters, filtersFromParams, filtersToParams, hasAnyCriteria } from "@/lib/search";
import { AMENITY_GROUPS, toSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getPropertyBySlug((await params).slug);
  if (!p) return { title: "Property not found" };
  return { title: `${p.title}, ${p.location.cityName} — ${formatPrice(p.price)}`, description: p.description };
}

export default async function PropertyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const p = getPropertyBySlug(slug);
  if (!p) notFound();

  const sp = await searchParams;
  const { filters: context } = filtersFromParams(sp);
  const fromSearch = hasAnyCriteria(context) || !!context.q;
  const ctxQuery = fromSearch ? filtersToParams({ ...context, page: 1 }).toString() : "";
  const all = getAllProperties();
  const recs = recommend(p, all, fromSearch ? context : undefined, 8);

  const ppsf = Math.round(p.price / p.superBuiltUpArea);
  const peers = all.filter((x) => x.location.locality === p.location.locality && x.type !== "Plot" && p.type !== "Plot");
  const avgPpsf = peers.length > 2 ? Math.round(peers.reduce((s, x) => s + x.price / x.superBuiltUpArea, 0) / peers.length) : null;
  const vsAvg = avgPpsf ? Math.round(((ppsf - avgPpsf) / avgPpsf) * 100) : null;
  const isPlot = p.type === "Plot";

  const facts: [icon: string, label: string, value: string][] = [
    ["bed", "Configuration", bhkLabel(p.bhk, p.type)],
    ["building", "Property type", p.type],
    ...(isPlot
      ? ([["area", "Plot area", formatSqft(p.plotArea ?? p.superBuiltUpArea)]] as [string, string, string][])
      : ([
          ["area", "Carpet area", formatSqft(p.carpetArea)],
          ["area", "Built-up area", formatSqft(p.builtUpArea)],
          ["area", "Super built-up area", formatSqft(p.superBuiltUpArea)],
          ...(p.plotArea ? [["layers", "Plot area", formatSqft(p.plotArea)]] : []),
          ["bath", "Bathrooms", String(p.bathrooms)],
          ["sofa", "Balconies", String(p.balconies)],
          ["layers", "Floor", p.floor !== undefined ? `${p.floor} of ${p.totalFloors}` : `${p.totalFloors}-storey`],
          ["compass", "Facing", p.facing],
          ["sofa", "Furnishing", p.furnishing],
        ] as [string, string, string][])),
    ["calendar", "Status", p.status],
    ["calendar", "Possession", p.possession],
    ...(p.ageYears !== undefined ? ([["calendar", "Age of property", p.ageYears === 0 ? "New" : `${p.ageYears} year${p.ageYears > 1 ? "s" : ""}`]] as [string, string, string][]) : []),
    ...(isPlot ? [] : ([["car", "Parking", `${p.parking.covered} covered${p.parking.open ? `, ${p.parking.open} open` : ""}`]] as [string, string, string][])),
    ["key", "Ownership", p.ownership],
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
  const crumb = (q: string) => `/search?f=1&${q}`;

  return (
    <SiteShell page={site}>
      <div className="container detail">
        <nav className="crumbs" aria-label="Breadcrumb">
          {fromSearch && (
            <Link href={`/search?${ctxQuery}`} className="back-link">
              <Icon name="back" size={15} /> Back to results
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
            <p className="kicker">
              {p.projectName} · by {p.developer}
            </p>
            <h1>{p.title}</h1>
            <p className="muted detail-address">
              <Icon name="pin" size={15} /> {loc.address}
            </p>
            <div className="detail-tags">
              <span className="badge badge-soft">{bhkLabel(p.bhk, p.type)}</span>
              <span className="badge badge-soft">{formatSqft(p.superBuiltUpArea)}</span>
              <span className="badge badge-soft">{p.status}</span>
              {p.rera.applicable ? (
                <span className="badge badge-ok">
                  <Icon name="shield" size={13} /> RERA registered
                </span>
              ) : (
                <span className="badge badge-warn">RERA not applicable</span>
              )}
            </div>
          </div>
          <div className="detail-price">
            <strong>{formatPrice(p.price)}</strong>
            <span className="muted">₹{formatNumber(ppsf)} / sq.ft</span>
          </div>
        </header>

        <div className="detail-gallery">
          <figure className="gal-main">
            <PropertyArt id={p.id} type={p.type} hue={p.hue} images={p.images} label={p.title} className="gal-art" />
            {!p.images.length && <figcaption>Illustration — photos to be added by the seller</figcaption>}
          </figure>
          {!isPlot && (
            <figure className="gal-plan">
              <FloorPlan bhk={p.bhk} bathrooms={p.bathrooms} balconies={p.balconies} carpetArea={p.carpetArea} />
              <figcaption>Indicative {bhkLabel(p.bhk)} layout · {formatSqft(p.carpetArea)} carpet</figcaption>
            </figure>
          )}
        </div>

        <div className="detail-grid">
          <div className="detail-main">
            <section className="panel" aria-labelledby="facts">
              <h2 id="facts">Property details</h2>
              <dl className="facts">
                {facts.map(([icon, label, value]) => (
                  <div key={label} className="fact">
                    <Icon name={icon} size={18} />
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={`panel rera ${p.rera.applicable ? "is-ok" : "is-warn"}`} aria-labelledby="rera">
              <h2 id="rera">
                <Icon name="shield" size={20} /> RERA information
              </h2>
              {p.rera.applicable ? (
                <dl className="rera-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>Registered</dd>
                  </div>
                  <div>
                    <dt>RERA number</dt>
                    <dd className="mono">{p.rera.number}</dd>
                  </div>
                  <div>
                    <dt>Authority</dt>
                    <dd>{p.rera.authority}</dd>
                  </div>
                </dl>
              ) : (
                <p>
                  <b>Not applicable.</b> {p.rera.note}
                </p>
              )}
              <a href={p.rera.website} target="_blank" rel="noopener noreferrer" className="ext-link">
                Verify on the {p.rera.authority} portal <Icon name="external" size={14} />
              </a>
            </section>

            <section className="panel" aria-labelledby="overview">
              <h2 id="overview">Overview</h2>
              <p className="lead">{p.description}</p>
              <ul className="highlights">
                {p.highlights.map((h) => (
                  <li key={h}>
                    <Icon name="check" size={16} /> {h}
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel" aria-labelledby="amenities">
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
                          <li key={a}>
                            <Icon name="check" size={14} /> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel" aria-labelledby="specs">
              <h2 id="specs">Specifications</h2>
              <dl className="spec-list">
                {specs.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="panel" aria-labelledby="location">
              <h2 id="location">Location & nearby</h2>
              <p className="loc-path">
                <span>{loc.cityName}</span> <Icon name="arrow" size={14} /> <span>{loc.localityName}</span> <Icon name="arrow" size={14} /> <span>{loc.areaName}</span>
              </p>
              <ul className="nearby">
                {p.nearby.map((n) => (
                  <li key={n.name}>
                    <span className="nearby-kind">{n.kind}</span>
                    <span>{n.name}</span>
                    <b>{n.distanceKm} km</b>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel" aria-labelledby="loan">
              <h2 id="loan">Home loan</h2>
              <p className="muted">Approved by: {p.approvedBanks.join(" · ")}</p>
            </section>
          </div>

          <aside className="detail-aside">
            <div className="panel price-card">
              <p className="muted">Price</p>
              <p className="price-big">{formatPrice(p.price)}</p>
              <p className="muted">
                ₹{formatNumber(ppsf)} / sq.ft {p.maintenancePerMonth ? `· ₹${formatNumber(p.maintenancePerMonth)} maintenance` : ""}
              </p>
              {vsAvg !== null && (
                <p className={`insight ${vsAvg <= 0 ? "is-good" : ""}`}>
                  {vsAvg === 0 ? "At" : `${Math.abs(vsAvg)}% ${vsAvg < 0 ? "below" : "above"}`} the {loc.localityName} average of ₹{formatNumber(avgPpsf!)} / sq.ft
                </p>
              )}
              <EmiCalculator price={p.price} />
              <a className="btn btn-accent btn-block" href="#similar">
                See similar homes
              </a>
            </div>
          </aside>
        </div>

        <section id="similar" className="similar" aria-labelledby="similar-title">
          <div className="close-head">
            <span className="kicker">
              <Icon name="spark" size={15} /> You may also like
            </span>
            <h2 id="similar-title">Similar properties you may like</h2>
            <p className="muted">
              Picked for their location, configuration and price compared with this {bhkLabel(p.bhk, p.type)} in {loc.areaName}
              {fromSearch && hasAnyCriteria(context) ? <> — and your search for <b>{describeFilters(context)}</b></> : null}.
            </p>
          </div>
          {recs.length ? (
            <div className="grid-cards">
              {recs.map((r) => (
                <PropertyCard
                  key={r.property.id}
                  p={toSummary(r.property)}
                  reasons={r.reasons}
                  score={r.score}
                  href={`/property/${r.property.slug}${ctxQuery ? `?${ctxQuery}` : ""}`}
                />
              ))}
            </div>
          ) : (
            <p className="muted">No similar homes listed in {loc.cityName} right now.</p>
          )}
        </section>
      </div>
    </SiteShell>
  );
}

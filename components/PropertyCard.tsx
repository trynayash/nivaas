import Link from "next/link";
import { PropertyArt } from "./PropertyArt";
import { bhkLabel, cx, formatNumber, formatPrice } from "@/lib/format";
import type { PropertySummary } from "@/lib/types";

export function SampleTag({ className }: { className?: string }) {
  return (
    <span className={cx("sample-tag", className)} title="Demonstration data — not a real property">
      Sample listing
    </span>
  );
}

export function PropertyCard({
  p,
  href,
  variant = "grid",
  reasons,
  score,
  disableLink,
}: {
  p: PropertySummary;
  href?: string;
  variant?: "grid" | "row";
  reasons?: string[];
  score?: number;
  disableLink?: boolean;
}) {
  const url = href ?? `/property/${p.slug}`;
  const ppsf = Math.round(p.price / p.superBuiltUpArea);
  const isPlot = p.type === "Plot";
  const typeLabel = isPlot ? "Plot" : `${bhkLabel(p.bhk)} ${p.type === "Apartment" ? "flat" : p.type.toLowerCase()}`;

  const facts = [
    `${formatNumber(p.superBuiltUpArea)} sq.ft${isPlot ? "" : " super"}`,
    !isPlot && `${formatNumber(p.carpetArea)} carpet`,
    p.status === "Ready to Move" ? "Ready to move" : `Possession ${p.possession}`,
    p.reraApplicable ? "RERA registered" : "RERA n/a",
  ].filter(Boolean) as string[];

  const body = (
    <>
      <div className="pc-media">
        <PropertyArt id={p.id} type={p.type} hue={p.hue} images={p.images} label={p.title} className="pc-art" />
        {p.isSample && <SampleTag className="pc-sample" />}
      </div>
      <div className="pc-body">
        <div className="pc-price">
          <strong>{formatPrice(p.price)}</strong>
          <span>₹{formatNumber(ppsf)}/sq.ft</span>
        </div>
        <h3 className="pc-title">
          {typeLabel} · {p.areaName}, {p.localityName}
        </h3>
        <p className="pc-sub">
          {p.projectName}
          {variant === "row" && p.developer !== "Owner (resale)" ? ` by ${p.developer}` : ""}
          {variant === "row" && p.developer === "Owner (resale)" ? " · resale by owner" : ""} · {p.cityName}
        </p>
        <p className="pc-facts">{facts.join(" · ")}</p>
        {variant === "row" && (
          <p className="pc-meta">
            {p.floor !== undefined ? `Floor ${p.floor} of ${p.totalFloors} · ` : ""}
            {p.furnishing}
            {p.amenities.length ? ` · ${p.amenities.slice(0, 3).join(", ")}` : ""}
          </p>
        )}
        {reasons && reasons.length > 0 && (
          <p className="pc-reasons">
            {typeof score === "number" && <b>{score}% similar</b>}
            {reasons.map((r) => (
              <span key={r} className={cx(r === "Matches your search" && "is-strong")}>
                {r}
              </span>
            ))}
          </p>
        )}
      </div>
    </>
  );
  const cls = cx("pcard", `pcard-${variant}`);
  if (disableLink) return <div className={cls}>{body}</div>;
  return (
    <Link href={url} className={cls}>
      {body}
    </Link>
  );
}

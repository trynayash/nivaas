import Link from "next/link";
import { PropertyArt } from "./PropertyArt";
import { Icon } from "./Icon";
import { bhkLabel, cx, formatNumber, formatPrice } from "@/lib/format";
import type { PropertySummary } from "@/lib/types";

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
  variant?: "grid" | "row" | "compact";
  reasons?: string[];
  score?: number;
  disableLink?: boolean;
}) {
  const url = href ?? `/property/${p.slug}`;
  const ppsf = Math.round(p.price / p.superBuiltUpArea);
  const body = (
    <>
      <div className="pc-media">
        <PropertyArt id={p.id} type={p.type} hue={p.hue} images={p.images} label={p.title} className="pc-art" />
        <div className="pc-badges">
          {p.featured && <span className="badge badge-accent">Featured</span>}
          {p.reraApplicable ? (
            <span className="badge badge-ok">
              <Icon name="shield" size={12} /> RERA
            </span>
          ) : null}
        </div>
        {typeof score === "number" && <span className="pc-score" title="Similarity score">{score}% match</span>}
      </div>
      <div className="pc-body">
        <div className="pc-price">
          <strong>{formatPrice(p.price)}</strong>
          {variant !== "compact" && <span className="muted">₹{formatNumber(ppsf)}/sq.ft</span>}
        </div>
        <h3 className="pc-title">{p.title}</h3>
        <p className="pc-loc">
          <Icon name="pin" size={14} /> {p.areaName}, {p.localityName}, {p.cityName}
        </p>
        <ul className="pc-facts">
          <li>
            <Icon name="bed" size={15} /> {bhkLabel(p.bhk, p.type)}
          </li>
          <li>
            <Icon name="area" size={15} /> {formatNumber(p.superBuiltUpArea)} sq.ft
          </li>
          {variant !== "compact" && (
            <li>
              <Icon name="calendar" size={15} /> {p.status}
            </li>
          )}
        </ul>
        {variant === "row" && (
          <p className="pc-meta muted">
            {p.projectName} · {p.furnishing} · {p.amenities.slice(0, 3).join(" · ")}
          </p>
        )}
        {reasons && reasons.length > 0 && (
          <ul className="pc-reasons">
            {reasons.map((r) => (
              <li key={r} className={cx(r === "Matches your search" && "is-strong")}>
                {r}
              </li>
            ))}
          </ul>
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

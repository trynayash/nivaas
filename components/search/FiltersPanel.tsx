"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getCity } from "@/lib/locations";
import { Facets, Filters, SORTS, SortKey, filtersToParams } from "@/lib/search";
import { CRORE, LAKH, cx, formatPrice } from "@/lib/format";
import { FURNISHINGS, PROPERTY_TYPES } from "@/lib/types";

const PRICE_STEPS = [20, 30, 40, 50, 60, 75, 90].map((l) => l * LAKH).concat([1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((c) => c * CRORE));
const AREA_STEPS = [500, 750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 4000, 5000];
const QUICK_BUDGETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under ₹50 L", max: 50 * LAKH },
  { label: "Under ₹1 Cr", max: CRORE },
  { label: "₹1 – 2 Cr", min: CRORE, max: 2 * CRORE },
  { label: "₹2 Cr +", min: 2 * CRORE },
];
const TOP_AMENITIES = ["Swimming Pool", "Gymnasium", "Clubhouse", "Children's Play Area", "Power Backup", "Lift", "24x7 Security", "EV Charging", "Private Garden", "Sea View Deck"];

function useApply(filters: Filters) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const apply = (patch: Partial<Filters>) => {
    const next: Filters = { ...filters, ...patch, page: 1 };
    start(() => router.push(`/search?${filtersToParams(next).toString()}`, { scroll: false }));
  };
  return { apply, pending };
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FiltersPanel({ filters, facets }: { filters: Filters; facets: Facets }) {
  const { apply, pending } = useApply(filters);
  const [open, setOpen] = useState(false);
  const city = getCity(filters.city);
  const activeCount =
    (filters.city ? 1 : 0) +
    filters.bhk.length +
    (filters.minPrice || filters.maxPrice ? 1 : 0) +
    filters.types.length +
    (filters.status ? 1 : 0) +
    filters.furnishing.length +
    (filters.minArea || filters.maxArea ? 1 : 0) +
    filters.amenities.length;

  return (
    <div className={cx("filters", open && "is-open", pending && "is-pending")}>
      <button type="button" className="filters-toggle btn btn-secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Hide filters" : "Filters"}
        {activeCount > 0 && <span className="num"> ({activeCount})</span>}
      </button>
      <div className="filters-body">
        <div className="filters-title">
          <h2>Filters</h2>
          {activeCount > 0 && (
            <button type="button" className="text-link" onClick={() => apply({ city: undefined, localities: [], areas: [], bhk: [], minPrice: undefined, maxPrice: undefined, types: [], status: undefined, furnishing: [], minArea: undefined, maxArea: undefined, amenities: [] })}>
              Reset all
            </button>
          )}
        </div>

        {/* Location hierarchy */}
        <fieldset className="fgroup">
          <legend>Location</legend>
          <label className="field">
            <span className="sr-only">City</span>
            <select value={filters.city ?? ""} onChange={(e) => apply({ city: e.target.value || undefined, localities: [], areas: [] })}>
              <option value="">All cities</option>
              {facets.cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </label>
          {city && (
            <ul className="loc-tree">
              {facets.localities.map((l) => {
                const checked = filters.localities.includes(l.slug);
                return (
                  <li key={l.slug}>
                    <label className={cx("check", l.count === 0 && !checked && "is-empty")}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const areasOfLoc = l.areas.map((a) => a.slug);
                          apply(
                            checked
                              ? { localities: filters.localities.filter((x) => x !== l.slug), areas: filters.areas.filter((a) => !areasOfLoc.includes(a)) }
                              : { localities: [...filters.localities, l.slug] }
                          );
                        }}
                      />
                      <span>{l.name}</span>
                      <em>{l.count}</em>
                    </label>
                    {checked && (
                      <ul className="loc-areas">
                        {l.areas.map((a) => (
                          <li key={a.slug}>
                            <label className={cx("check check-sm", a.count === 0 && !filters.areas.includes(a.slug) && "is-empty")}>
                              <input type="checkbox" checked={filters.areas.includes(a.slug)} onChange={() => apply({ areas: toggle(filters.areas, a.slug) })} />
                              <span>{a.name}</span>
                              <em>{a.count}</em>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!city && <p className="hint">Pick a city to narrow down by locality and area.</p>}
        </fieldset>

        {/* Configuration */}
        <fieldset className="fgroup">
          <legend>Configuration</legend>
          <div className="chip-row">
            {[1, 2, 3, 4, 5, 0].map((b) => {
              const n = facets.bhk[String(b)] ?? 0;
              const on = filters.bhk.includes(b);
              if (b === 0 && !n && !on) return null;
              return (
                <button key={b} type="button" className={cx("chip chip-sm", on && "is-on")} aria-pressed={on} onClick={() => apply({ bhk: toggle(filters.bhk, b).sort() })} disabled={!n && !on}>
                  {b === 0 ? "Plot" : `${b} BHK`}
                  <small>{n}</small>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Budget — never pre-applied */}
        <fieldset className="fgroup">
          <legend>Budget</legend>
          <div className="range-row">
            <select aria-label="Minimum price" value={filters.minPrice ?? ""} onChange={(e) => apply({ minPrice: Number(e.target.value) || undefined })}>
              <option value="">No min</option>
              {PRICE_STEPS.filter((p) => !filters.maxPrice || p < filters.maxPrice).map((p) => (
                <option key={p} value={p}>
                  {formatPrice(p)}
                </option>
              ))}
            </select>
            <span>to</span>
            <select aria-label="Maximum price" value={filters.maxPrice ?? ""} onChange={(e) => apply({ maxPrice: Number(e.target.value) || undefined })}>
              <option value="">No max</option>
              {PRICE_STEPS.filter((p) => !filters.minPrice || p > filters.minPrice).map((p) => (
                <option key={p} value={p}>
                  {formatPrice(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="chip-row">
            {QUICK_BUDGETS.map((q) => {
              const on = filters.minPrice === q.min && filters.maxPrice === q.max;
              return (
                <button key={q.label} type="button" className={cx("chip chip-sm", on && "is-on")} aria-pressed={on} onClick={() => apply(on ? { minPrice: undefined, maxPrice: undefined } : { minPrice: q.min, maxPrice: q.max })}>
                  {q.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Type */}
        <fieldset className="fgroup">
          <legend>Property type</legend>
          {PROPERTY_TYPES.map((t) => {
            const n = facets.types[t] ?? 0;
            const on = filters.types.includes(t);
            if (!n && !on) return null;
            return (
              <label key={t} className="check">
                <input type="checkbox" checked={on} onChange={() => apply({ types: toggle(filters.types, t) })} />
                <span>{t}</span>
                <em>{n}</em>
              </label>
            );
          })}
        </fieldset>

        {/* Possession */}
        <fieldset className="fgroup">
          <legend>Possession</legend>
          <div className="seg">
            {([
              ["", "Any"],
              ["Ready to Move", "Ready"],
              ["Under Construction", "Under construction"],
            ] as const).map(([v, label]) => (
              <button key={v} type="button" className={cx((filters.status ?? "") === v && "is-on")} onClick={() => apply({ status: (v || undefined) as Filters["status"] })}>
                {label}
                {v && <small>{facets.status[v] ?? 0}</small>}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Furnishing */}
        <fieldset className="fgroup">
          <legend>Furnishing</legend>
          {FURNISHINGS.map((f) => (
            <label key={f} className="check">
              <input type="checkbox" checked={filters.furnishing.includes(f)} onChange={() => apply({ furnishing: toggle(filters.furnishing, f) })} />
              <span>{f}</span>
              <em>{facets.furnishing[f] ?? 0}</em>
            </label>
          ))}
        </fieldset>

        {/* Size */}
        <fieldset className="fgroup">
          <legend>Super built-up area (sq.ft)</legend>
          <div className="range-row">
            <select aria-label="Minimum area" value={filters.minArea ?? ""} onChange={(e) => apply({ minArea: Number(e.target.value) || undefined })}>
              <option value="">No min</option>
              {AREA_STEPS.map((a) => (
                <option key={a} value={a}>
                  {a.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
            <span>to</span>
            <select aria-label="Maximum area" value={filters.maxArea ?? ""} onChange={(e) => apply({ maxArea: Number(e.target.value) || undefined })}>
              <option value="">No max</option>
              {AREA_STEPS.map((a) => (
                <option key={a} value={a}>
                  {a.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        {/* Amenities */}
        <fieldset className="fgroup">
          <legend>Amenities</legend>
          {TOP_AMENITIES.map((a) => (
            <label key={a} className="check">
              <input type="checkbox" checked={filters.amenities.includes(a)} onChange={() => apply({ amenities: toggle(filters.amenities, a) })} />
              <span>{a}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}

export function SortSelect({ filters }: { filters: Filters }) {
  const router = useRouter();
  return (
    <label className="sort">
      <span>Sort by</span>
      <select
        value={filters.sort}
        onChange={(e) => router.push(`/search?${filtersToParams({ ...filters, sort: e.target.value as SortKey, page: 1 }).toString()}`, { scroll: false })}
      >
        {SORTS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}


"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FACINGS, OWNERSHIPS, STATUSES, type ListingInput, typeLabel, validateListing } from "@/lib/listings/input";
import { CITIES, getCity } from "@/lib/locations";
import { cx, formatPrice } from "@/lib/format";
import { AMENITY_GROUPS, FURNISHINGS, PROPERTY_TYPES } from "@/lib/types";
import { api } from "@/lib/client-api";
import { PhotoUploader } from "./PhotoUploader";

type Errors = Record<string, string>;

function F({ label, name, errors, hint, children, wide }: { label: string; name: string; errors: Errors; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  const err = errors[name];
  return (
    <div className={cx("lf-field", wide && "is-wide", err && "has-error")} data-field={name}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {children}
      {err ? (
        <p className="lf-error" id={`e-${name}`} role="alert">
          {err}
        </p>
      ) : hint ? (
        <p className="st-hint">{hint}</p>
      ) : null}
    </div>
  );
}

const asText = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const listText = (v: string[] | undefined) => (v ?? []).join("\n");
const fromLines = (s: string) => s.split("\n");
const fromCommas = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** A comma-separated list field. Keeps what's typed (trailing commas, spaces) and reports the parsed list. */
function CommaInput({ id, value, onChange }: { id: string; value: string[]; onChange: (list: string[]) => void }) {
  const [raw, setRaw] = useState(() => value.join(", "));
  return (
    <input
      id={id}
      className="st-input"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(fromCommas(e.target.value));
      }}
      onBlur={() => setRaw(value.join(", "))}
    />
  );
}

export function ListingForm({
  initial,
  id,
  slug,
  isSample,
  rev,
}: {
  initial: ListingInput;
  id?: string;
  slug?: string;
  isSample?: boolean;
  /** The stored revision this form was loaded from; a save from a stale form is refused. */
  rev?: number;
}) {
  const router = useRouter();
  const [v, setV] = useState<ListingInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // Unsaved = differs from what the server last confirmed (edits made while a save runs stay unsaved).
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const dirty = useMemo(() => JSON.stringify(v) !== savedJson, [v, savedJson]);
  const revRef = useRef(rev);
  const folder = useRef(id ?? `new-${Math.random().toString(36).slice(2, 8)}`).current;
  const onBusyChange = useCallback((n: number) => setUploading(n), []);

  const set = <K extends keyof ListingInput>(k: K, val: ListingInput[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setErrors((e) => (e[k as string] ? { ...e, [k as string]: "" } : e));
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const city = getCity(v.city);
  const locality = city?.localities.find((l) => l.slug === v.locality);
  const isPlot = v.type === "Plot";
  const priceNum = Number(v.price);
  const autoTitle = useMemo(() => {
    const area = locality?.areas.find((a) => a.slug === v.area);
    return area && locality ? `${typeLabel(String(v.type), Number(v.bhk) || 0)} in ${area.name}, ${locality.name}` : "";
  }, [v.type, v.bhk, v.area, locality]);

  async function save(publish?: boolean) {
    if (uploading) {
      setMessage({ kind: "error", text: "Wait for the photos to finish uploading, then save." });
      return;
    }
    const body = publish === undefined ? v : { ...v, published: publish };
    const check = validateListing(body);
    if (!check.ok) {
      setErrors(check.errors);
      const n = Object.keys(check.errors).length;
      setMessage({ kind: "error", text: `${n} field${n > 1 ? "s need" : " needs"} attention.` });
      requestAnimationFrame(() => {
        const field = document.querySelector<HTMLElement>(".lf-field.has-error");
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
        field?.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const sent = JSON.stringify(body);
      const r = await api<{ listing: { id: string; published: boolean; rev?: number } }>(id ? `/api/admin/listings/${id}` : "/api/admin/listings", {
        method: id ? "PUT" : "POST",
        body: { ...body, rev: revRef.current },
      });
      if (!r.ok) {
        if (r.data.fields) setErrors(r.data.fields as Errors);
        setMessage({ kind: "error", text: r.error });
        return;
      }
      const listing = r.data.listing;
      revRef.current = listing.rev;
      setSavedJson(sent);
      setV((s) => ({ ...s, published: listing.published }));
      if (!id) {
        router.replace(`/admin/listings/${listing.id}?saved=1`);
        return;
      }
      setMessage({ kind: "ok", text: listing.published ? "Saved. The listing is live." : "Saved as a draft. Visitors can’t see it yet." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id || !window.confirm("Delete this listing permanently? Its photos are deleted too. This can’t be undone.")) return;
    setSaving(true);
    try {
      const r = await api(`/api/admin/listings/${id}`, { method: "DELETE" });
      if (r.ok) {
        setSavedJson(JSON.stringify(v)); // nothing left to lose: don't warn on the way out
        router.replace("/admin/listings?deleted=1");
      } else setMessage({ kind: "error", text: r.error });
    } finally {
      setSaving(false);
    }
  }

  const input = (name: keyof ListingInput, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`f-${name}`}
      className="st-input"
      value={asText(v[name])}
      onChange={(e) => set(name, e.target.value as never)}
      aria-invalid={!!errors[name] || undefined}
      aria-describedby={errors[name] ? `e-${name}` : undefined}
      {...props}
    />
  );
  const select = (name: keyof ListingInput, options: readonly (string | { value: string; label: string })[], onPick?: (val: string) => void) => (
    <select
      id={`f-${name}`}
      className="st-input"
      value={asText(v[name])}
      onChange={(e) => (onPick ? onPick(e.target.value) : set(name, e.target.value as never))}
      aria-invalid={!!errors[name] || undefined}
    >
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
  const check = (name: keyof ListingInput, label: string) => (
    <label className="st-switch">
      <input type="checkbox" checked={!!v[name]} onChange={(e) => set(name, e.target.checked as never)} />
      <span className="st-switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );

  const nearby = (v.nearby ?? []) as { kind: string; name: string; distanceKm: number | string }[];

  return (
    <form
      className="lf"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {isSample && <p className="lf-note">This is a sample listing. It stays tagged “Sample listing” on the site even after you edit it.</p>}

      <section className="lf-sec">
        <h2>Photos</h2>
        <PhotoUploader images={(v.images ?? []) as string[]} folder={folder} onChange={(imgs) => set("images", imgs)} onBusyChange={onBusyChange} />
        {errors.images && <p className="lf-error">{errors.images}</p>}
      </section>

      <section className="lf-sec">
        <h2>Basics</h2>
        <div className="lf-grid">
          <F label="Property type" name="type" errors={errors}>
            {select("type", PROPERTY_TYPES, (t) => {
              set("type", t);
              if (t === "Plot") set("bhk", 0);
              else if (!Number(v.bhk)) set("bhk", 2);
            })}
          </F>
          {!isPlot && (
            <>
              <F label="Bedrooms (BHK)" name="bhk" errors={errors}>
                {select("bhk", ["1", "2", "3", "4", "5", "6", "7", "8"].map((b) => ({ value: b, label: `${b} BHK` })))}
              </F>
              <F label="Bathrooms" name="bathrooms" errors={errors}>
                {input("bathrooms", { type: "number", min: 0, max: 15, inputMode: "numeric" })}
              </F>
              <F label="Balconies" name="balconies" errors={errors}>
                {input("balconies", { type: "number", min: 0, max: 15, inputMode: "numeric" })}
              </F>
            </>
          )}
          <F label="Project / building" name="projectName" errors={errors}>
            {input("projectName", { placeholder: "e.g. Sagar Retreat", maxLength: 100 })}
          </F>
          <F label="Developer or seller" name="developer" errors={errors} hint="Use “Owner (resale)” for owner listings.">
            {input("developer", { placeholder: "e.g. Konkan Coast Realty", maxLength: 100, list: "developer-options" })}
            <datalist id="developer-options">
              <option value="Owner (resale)" />
            </datalist>
          </F>
          <F label="Title" name="title" errors={errors} wide hint={autoTitle ? `Leave empty to use “${autoTitle}”.` : "Leave empty to build it from type, BHK and area."}>
            {input("title", { placeholder: autoTitle || "Optional", maxLength: 140 })}
          </F>
        </div>
      </section>

      <section className="lf-sec">
        <h2>Location</h2>
        <div className="lf-grid">
          <F label="City" name="city" errors={errors}>
            {select("city", CITIES.map((c) => ({ value: c.slug, label: c.name })), (c) => {
              setV((s) => ({ ...s, city: c, locality: "", area: "" }));
            })}
          </F>
          <F label="Locality" name="locality" errors={errors}>
            {select("locality", [{ value: "", label: "Choose…" }, ...(city?.localities ?? []).map((l) => ({ value: l.slug, label: l.name }))], (l) => {
              setV((s) => ({ ...s, locality: l, area: "" }));
              setErrors((e) => ({ ...e, locality: "" }));
            })}
          </F>
          <F label="Area" name="area" errors={errors}>
            {select("area", [{ value: "", label: locality ? "Choose…" : "Pick a locality first" }, ...(locality?.areas ?? []).map((a) => ({ value: a.slug, label: a.name }))])}
          </F>
          <F label="Pincode" name="pincode" errors={errors}>
            {input("pincode", { inputMode: "numeric", maxLength: 6, placeholder: "6 digits" })}
          </F>
          <F label="Address" name="address" errors={errors} wide>
            {input("address", { placeholder: "Building, street, landmark", maxLength: 240 })}
          </F>
        </div>
      </section>

      <section className="lf-sec">
        <h2>Price and size</h2>
        <div className="lf-grid">
          <F label="Asking price (₹)" name="price" errors={errors} hint={priceNum >= 100000 ? `Shown as ${formatPrice(priceNum)}` : "Full amount in rupees, e.g. 8500000"}>
            {input("price", { type: "number", min: 100000, step: 1000, inputMode: "numeric" })}
          </F>
          {isPlot ? (
            <F label="Plot area (sq.ft)" name="plotArea" errors={errors}>
              {input("plotArea", { type: "number", min: 100, inputMode: "numeric" })}
            </F>
          ) : (
            <>
              <F label="Carpet area (sq.ft)" name="carpetArea" errors={errors}>
                {input("carpetArea", { type: "number", min: 50, inputMode: "numeric" })}
              </F>
              <F label="Built-up area (sq.ft)" name="builtUpArea" errors={errors} hint="Optional">
                {input("builtUpArea", { type: "number", min: 50, inputMode: "numeric" })}
              </F>
              <F label="Super built-up (sq.ft)" name="superBuiltUpArea" errors={errors}>
                {input("superBuiltUpArea", { type: "number", min: 50, inputMode: "numeric" })}
              </F>
              {(v.type === "Villa" || v.type === "Independent House" || v.type === "Row House") && (
                <F label="Plot area (sq.ft)" name="plotArea" errors={errors} hint="Optional">
                  {input("plotArea", { type: "number", min: 100, inputMode: "numeric" })}
                </F>
              )}
            </>
          )}
          <F label="Maintenance (₹/month)" name="maintenancePerMonth" errors={errors}>
            {input("maintenancePerMonth", { type: "number", min: 0, inputMode: "numeric" })}
          </F>
        </div>
      </section>

      <section className="lf-sec">
        <h2>Building and possession</h2>
        <div className="lf-grid">
          <F label="Status" name="status" errors={errors}>
            {select("status", STATUSES, (s) => {
              set("status", s as never);
              if (s === "Ready to Move") set("possession", "Immediate");
              else if (v.possession === "Immediate") set("possession", "");
            })}
          </F>
          <F label="Possession" name="possession" errors={errors} hint="“Immediate” or a month, e.g. Dec 2027">
            {input("possession", { maxLength: 40 })}
          </F>
          {v.status === "Ready to Move" && !isPlot && (
            <F label="Age (years)" name="ageYears" errors={errors} hint="Optional">
              {input("ageYears", { type: "number", min: 0, inputMode: "numeric" })}
            </F>
          )}
          {!isPlot && (
            <>
              <F label="Floor" name="floor" errors={errors} hint="Optional (0 = ground)">
                {input("floor", { type: "number", inputMode: "numeric" })}
              </F>
              <F label="Total floors" name="totalFloors" errors={errors} hint="Optional">
                {input("totalFloors", { type: "number", min: 1, inputMode: "numeric" })}
              </F>
              <F label="Furnishing" name="furnishing" errors={errors}>
                {select("furnishing", FURNISHINGS)}
              </F>
            </>
          )}
          <F label="Facing" name="facing" errors={errors}>
            {select("facing", FACINGS)}
          </F>
          <F label="Ownership" name="ownership" errors={errors}>
            {select("ownership", OWNERSHIPS)}
          </F>
        </div>
      </section>

      <section className="lf-sec">
        <h2>RERA</h2>
        {check("reraApplicable", "This project is registered under RERA")}
        <div className="lf-grid">
          {v.reraApplicable ? (
            <F label="RERA registration number" name="reraNumber" errors={errors} wide hint={city ? `Registered with ${city.rera.authority}` : undefined}>
              {input("reraNumber", { maxLength: 80, placeholder: city?.slug === "bangalore" ? "PRM/KA/RERA/…" : "P5…" })}
            </F>
          ) : (
            <F label="Why RERA doesn’t apply" name="reraNote" errors={errors} wide>
              {input("reraNote", { maxLength: 300, placeholder: "e.g. Resale flat completed in 2012; OC available" })}
            </F>
          )}
        </div>
      </section>

      <section className="lf-sec">
        <h2>Amenities</h2>
        <div className="lf-amenities">
          {Object.entries(AMENITY_GROUPS).map(([group, items]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {items.map((a) => {
                const on = ((v.amenities ?? []) as string[]).includes(a);
                return (
                  <label key={a} className="check">
                    <input type="checkbox" checked={on} onChange={() => set("amenities", on ? (v.amenities as string[]).filter((x) => x !== a) : [...((v.amenities ?? []) as string[]), a])} />
                    <span>{a}</span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      </section>

      <section className="lf-sec">
        <h2>More details</h2>
        <div className="lf-grid">
          {!isPlot && (
            <>
              <F label="Covered parking" name="parkingCovered" errors={errors}>
                {input("parkingCovered", { type: "number", min: 0, inputMode: "numeric" })}
              </F>
              <F label="Open parking" name="parkingOpen" errors={errors}>
                {input("parkingOpen", { type: "number", min: 0, inputMode: "numeric" })}
              </F>
              <F label="Flooring" name="flooring" errors={errors}>
                {input("flooring", { maxLength: 80, placeholder: "e.g. Vitrified tiles" })}
              </F>
              <F label="Power backup" name="powerBackup" errors={errors}>
                {input("powerBackup", { maxLength: 80, placeholder: "e.g. Full backup" })}
              </F>
            </>
          )}
          <F label="Water supply" name="waterSupply" errors={errors}>
            {input("waterSupply", { maxLength: 80, placeholder: "e.g. 24 hrs · Municipal + borewell" })}
          </F>
          <F label="Overlooking" name="overlooking" errors={errors} hint="Comma-separated, e.g. Sea, Garden">
            <CommaInput id="f-overlooking" value={(v.overlooking ?? []) as string[]} onChange={(list) => set("overlooking", list)} />
          </F>
          <F label="Approved banks" name="approvedBanks" errors={errors} hint="Comma-separated" wide>
            <CommaInput id="f-approvedBanks" value={(v.approvedBanks ?? []) as string[]} onChange={(list) => set("approvedBanks", list)} />
          </F>
        </div>
        {check("gatedCommunity", "Gated community")}
      </section>

      <section className="lf-sec">
        <h2>Nearby places</h2>
        <table className="lf-nearby">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Distance (km)</th>
              <th>
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {nearby.map((n, i) => (
              <tr key={i}>
                {(["kind", "name", "distanceKm"] as const).map((k) => (
                  <td key={k}>
                    <input
                      className="st-input"
                      aria-label={`${k === "kind" ? "Type" : k === "name" ? "Name" : "Distance"} for place ${i + 1}`}
                      value={asText(n[k])}
                      type={k === "distanceKm" ? "number" : "text"}
                      step={k === "distanceKm" ? 0.1 : undefined}
                      placeholder={k === "kind" ? "Metro" : k === "name" ? "Nearest metro station" : "1.2"}
                      onChange={(e) => set("nearby", nearby.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) as never)}
                    />
                  </td>
                ))}
                <td>
                  <button type="button" className="st-icon-btn is-danger" aria-label={`Remove place ${i + 1}`} onClick={() => set("nearby", nearby.filter((_, j) => j !== i) as never)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.keys(errors).some((k) => k.startsWith("nearby")) && <p className="lf-error">Each nearby place needs a type, a name and a distance.</p>}
        {nearby.length < 12 && (
          <button type="button" className="st-btn st-btn-small" onClick={() => set("nearby", [...nearby, { kind: "", name: "", distanceKm: "" }] as never)}>
            + Add place
          </button>
        )}
      </section>

      <section className="lf-sec">
        <h2>Description</h2>
        <div className="lf-grid">
          <F label="About this home" name="description" errors={errors} wide>
            <textarea id="f-description" className="st-input" rows={6} maxLength={3000} value={asText(v.description)} onChange={(e) => set("description", e.target.value)} />
          </F>
          <F label="Highlights" name="highlights" errors={errors} wide hint="One per line, up to 8">
            <textarea id="f-highlights" className="st-input" rows={4} value={listText(v.highlights as string[])} onChange={(e) => set("highlights", fromLines(e.target.value))} />
          </F>
        </div>
        {check("featured", "Feature on the landing page (“Featured listings” source)")}
      </section>

      <div className="lf-bar">
        <div className="lf-bar-status">
          {message ? (
            <span className={cx("lf-msg", message.kind === "error" && "is-error")} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </span>
          ) : (
            <span className="st-hint">{uploading ? `Uploading ${uploading} photo${uploading > 1 ? "s" : ""}…` : dirty ? "Unsaved changes" : v.published ? "Live on the website" : "Draft — not visible to visitors"}</span>
          )}
        </div>
        <div className="lf-bar-actions">
          {id && (
            <button type="button" className="st-btn st-btn-ghost st-btn-danger" onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
          {id && slug && (
            <Link className="st-btn st-btn-ghost" href={`/property/${slug}${v.published ? "" : "?preview=1"}`} target="_blank">
              {v.published ? "View on site ↗" : "Preview ↗"}
            </Link>
          )}
          {v.published ? (
            <>
              <button type="button" className="st-btn" onClick={() => save(false)} disabled={saving}>
                Unpublish
              </button>
              <button type="submit" className="st-btn st-btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button type="submit" className="st-btn" disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button type="button" className="st-btn st-btn-primary" onClick={() => save(true)} disabled={saving}>
                Publish
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

import { describe, expect, it } from "vitest";
import { listingInputSchema, toInput, toProperty, validateListing } from "@/lib/listings/input";
import { generateProperties } from "@/lib/seed";

const samples = generateProperties();

describe("listing form schema", () => {
  it("accepts every sample listing and round-trips it unchanged", () => {
    for (const p of samples) {
      const r = listingInputSchema.safeParse(toInput(p));
      expect(r.success, p.id).toBe(true);
      if (!r.success) continue;
      const back = toProperty(r.data, { id: p.id, existing: p });
      expect({ ...back, createdAt: undefined }).toMatchObject({ id: p.id, slug: p.slug, price: p.price, bhk: p.bhk, title: p.title, superBuiltUpArea: p.superBuiltUpArea });
    }
  });

  it("reports every problem at once, including cross-field ones", () => {
    const r = validateListing({ ...toInput(), price: "" as never, city: "bangalore", locality: "whitefield", area: "nowhere" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(["price", "projectName", "area", "carpetArea", "superBuiltUpArea", "reraNumber"]));
  });

  it("rejects a carpet area larger than super built-up", () => {
    const input = { ...toInput(samples[0]), carpetArea: 5000, superBuiltUpArea: 1200 };
    const r = validateListing(input);
    expect(!r.ok && r.errors.carpetArea).toBeTruthy();
  });

  it("requires a plot area for plots and ignores BHK", () => {
    const base = { ...toInput(samples[0]), type: "Plot", bhk: 0, plotArea: undefined };
    expect(validateListing(base).ok).toBe(false);
    const ok = validateListing({ ...base, plotArea: 2400 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(toProperty(ok.data, { id: "LTEST" }).bhk).toBe(0);
  });

  it("only accepts uploaded photos", () => {
    const r = validateListing({ ...toInput(samples[0]), images: ["javascript:alert(1)"] });
    expect(!r.ok && r.errors["images.0"]).toBeTruthy();
    expect(validateListing({ ...toInput(samples[0]), images: ["https://x.public.blob.vercel-storage.com/a.jpg", "/api/uploads/pABCDEF12.jpg"] }).ok).toBe(true);
  });

  it("keeps the slug stable when an existing listing is renamed", () => {
    const p = samples[0];
    const r = listingInputSchema.parse({ ...toInput(p), title: "Completely new title" });
    expect(toProperty(r, { id: p.id, existing: p }).slug).toBe(p.slug);
  });
});

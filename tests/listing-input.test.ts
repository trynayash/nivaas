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

describe("sample generator", () => {
  it("returns identical data on every call", () => {
    const a = generateProperties();
    const b = generateProperties();
    expect(b.map((p) => p.slug)).toEqual(a.map((p) => p.slug));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("hidden form fields", () => {
  const complete = () => {
    const p = samples.find((x) => x.type === "Apartment" && x.status === "Ready to Move")!;
    return toInput(p);
  };

  it("switching to Plot ignores half-typed flat fields", () => {
    const input = { ...complete(), type: "Plot", plotArea: 2400, carpetArea: "abc" as never, bathrooms: "" as never, floor: 99 };
    const r = validateListing(input);
    expect(r.ok ? "ok" : JSON.stringify(r.errors)).toBe("ok");
    if (r.ok) {
      expect(r.data.bhk).toBe(0);
      expect(r.data.carpetArea).toBeUndefined();
      expect(r.data.floor).toBeUndefined();
    }
  });

  it("drops a stale plot area from a flat and age from an under-construction home", () => {
    const r = validateListing({ ...complete(), plotArea: 5, status: "Under Construction", possession: "Dec 2027", ageYears: "x" as never });
    expect(r.ok ? "ok" : JSON.stringify(r.errors)).toBe("ok");
    if (r.ok) {
      expect(r.data.plotArea).toBeUndefined();
      expect(r.data.ageYears).toBeUndefined();
    }
  });

  it("ignores empty nearby rows and counts list limits after removing blank lines", () => {
    const r = validateListing({
      ...complete(),
      nearby: [{ kind: "", name: "", distanceKm: "" }],
      highlights: ["One", "", "Two", "", "", "", "", "", "", "", ""],
    });
    expect(r.ok ? "ok" : JSON.stringify(r.errors)).toBe("ok");
    if (r.ok) {
      expect(r.data.nearby).toEqual([]);
      expect(r.data.highlights).toEqual(["One", "Two"]);
    }
  });

  it("still enforces the limit on real items", () => {
    const r = validateListing({ ...complete(), highlights: Array.from({ length: 9 }, (_, i) => `Point ${i}`) });
    expect(r.ok).toBe(false);
  });
});

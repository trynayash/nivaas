import { describe, expect, it } from "vitest";
import { closeMatches, describeFilters, filtersFromParams, filtersToParams, parseQuery, search } from "@/lib/search";
import { generateProperties } from "@/lib/seed";

const all = generateProperties();

describe("parseQuery", () => {
  it.each([
    ["property in Bangalore", { city: "bangalore", bhk: [] }],
    ["2BHK in Bangalore", { city: "bangalore", bhk: [2] }],
    ["Bangalore mein 2BHK chahiye", { city: "bangalore", bhk: [2] }],
    ["3bhk banglore whitefeild", { city: "bangalore", localities: ["whitefield"], bhk: [3] }],
    ["3BHK in Madhli Aai, Murud Janjira", { city: "murud-janjira", localities: ["madhli-aai"], bhk: [3] }],
    ["2,3 bhk in hsr layout", { city: "bangalore", localities: ["hsr-layout"], bhk: [2, 3] }],
  ])("%s", (q, expected) => {
    expect(parseQuery(q)).toMatchObject(expected);
  });

  it("reads budgets in lakh and crore", () => {
    expect(parseQuery("3 bhk in pune under 1 crore")).toMatchObject({ maxPrice: 10_000_000 });
    expect(parseQuery("flats 80 lakh to 1.5 cr")).toMatchObject({ minPrice: 8_000_000, maxPrice: 15_000_000 });
    expect(parseQuery("under 1,20,00,000 in mumbai")).toMatchObject({ maxPrice: 12_000_000, city: "mumbai" });
  });

  it("reads type, status and furnishing", () => {
    expect(parseQuery("ready to move semi furnished villas in murud")).toMatchObject({
      types: ["Villa"],
      status: "Ready to Move",
      furnishing: ["Semi-Furnished"],
      city: "murud-janjira",
    });
  });

  it("does not match an ambiguous area name without its locality", () => {
    expect(parseQuery("phase 1").areas).toEqual([]);
    expect(parseQuery("phase 1 electronic city").areas).toEqual(["phase-1"]);
  });

  it("reports words it could not use", () => {
    expect(parseQuery("4bhk koramangala xyzzy").unmatched).toBe("xyzzy");
  });
});

describe("filters and search", () => {
  it("never applies a price filter the user didn't ask for", () => {
    const { filters } = filtersFromParams({ q: "3BHK in Bangalore" });
    expect(filters.minPrice).toBeUndefined();
    expect(filters.maxPrice).toBeUndefined();
  });

  it("round-trips filters through the URL", () => {
    const { filters } = filtersFromParams({ q: "2,3 bhk in hsr layout 80 lakh to 1.5 cr" });
    const again = filtersFromParams(Object.fromEntries(filtersToParams(filters))).filters;
    expect(again).toMatchObject({ city: filters.city, localities: filters.localities, bhk: filters.bhk, minPrice: filters.minPrice, maxPrice: filters.maxPrice });
  });

  it("only returns listings that match every filter", () => {
    const { filters } = filtersFromParams({ q: "3BHK in Madhli Aai, Murud Janjira" });
    const r = search(all, filters);
    expect(r.total).toBeGreaterThan(0);
    for (const p of r.allMatched) {
      expect(p.bhk).toBe(3);
      expect(p.location.locality).toBe("madhli-aai");
    }
    expect(describeFilters(filters)).toBe("3 BHK homes in Madhli Aai, Murud Janjira");
  });

  it("close matches exclude exact results and explain the difference", () => {
    const { filters } = filtersFromParams({ q: "3 bhk in bangalore under 1 crore" });
    const exact = search(all, filters).allMatched;
    const close = closeMatches(all, filters, new Set(exact.map((p) => p.id)));
    expect(close.length).toBeGreaterThan(0);
    for (const c of close) {
      expect(exact.some((p) => p.id === c.property.id)).toBe(false);
      expect(c.reasons.length).toBeGreaterThan(0);
      expect(c.property.location.city).toBe("bangalore");
    }
  });
});

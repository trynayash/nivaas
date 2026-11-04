import { describe, expect, it } from "vitest";
import { recommend } from "@/lib/recommend";
import { filtersFromParams } from "@/lib/search";
import { generateProperties } from "@/lib/seed";

const all = generateProperties();
const base = all.find((p) => p.location.locality === "madhli-aai" && p.bhk === 3)!;

describe("recommend", () => {
  const recs = recommend(base, all);

  it("never recommends the same home or another city", () => {
    expect(recs.some((r) => r.property.id === base.id)).toBe(false);
    expect(recs.every((r) => r.property.location.city === base.location.city)).toBe(true);
  });

  it("is sorted by score and explains each pick", () => {
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    expect(recs.every((r) => r.reasons.length > 0 && r.score <= 100)).toBe(true);
  });

  it("puts same-area, same-BHK homes first", () => {
    expect(recs[0].property.location.locality).toBe("madhli-aai");
    expect(recs[0].property.bhk).toBe(3);
  });

  it("boosts homes that match the visitor's search", () => {
    const ctx = filtersFromParams({ q: "3BHK in Madhli Aai, Murud Janjira" }).filters;
    const withCtx = recommend(base, all, ctx);
    expect(withCtx.filter((r) => r.matchesSearch).every((r) => r.reasons[0] === "Matches your search")).toBe(true);
    expect(withCtx[0].matchesSearch).toBe(true);
  });
});

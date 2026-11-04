// "Similar properties you may like" — contextual recommendations for the property detail page.
// Scores every other listing in the same city on location, configuration, price, type, size and
// amenities, then optionally boosts homes that also satisfy the visitor's original search.
import { distanceKm } from "./locations";
import { Filters, hasAnyCriteria, matches } from "./search";
import type { Property } from "./types";

export interface Recommendation {
  property: Property;
  score: number; // 0–100
  reasons: string[];
  matchesSearch: boolean;
}

export const WEIGHTS = {
  location: 30,
  configuration: 25,
  price: 22,
  type: 8,
  size: 8,
  amenities: 7,
};

export function similarity(base: Property, p: Property) {
  const reasons: string[] = [];
  let score = 0;

  // Location
  const d = distanceKm(base.location, p.location);
  if (p.location.area === base.location.area) {
    score += WEIGHTS.location;
    reasons.push(`Same area · ${p.location.areaName}`);
  } else if (p.location.locality === base.location.locality) {
    score += WEIGHTS.location * 0.85;
    reasons.push(`Same locality · ${p.location.localityName}`);
  } else if (d < 12) {
    score += WEIGHTS.location * Math.max(0.15, 0.7 - d / 20);
    reasons.push(`Nearby · ${d.toFixed(1)} km away`);
  }

  // Configuration
  if (p.bhk === base.bhk) {
    score += WEIGHTS.configuration;
    if (p.bhk > 0) reasons.push(`Same ${p.bhk} BHK configuration`);
    else reasons.push("Also a plot");
  } else if (Math.abs(p.bhk - base.bhk) === 1 && p.bhk > 0 && base.bhk > 0) {
    score += WEIGHTS.configuration * 0.4;
    reasons.push(`${p.bhk} BHK`);
  }

  // Price
  const diff = (p.price - base.price) / base.price;
  const priceScore = Math.max(0, 1 - Math.abs(diff) / 0.35);
  score += WEIGHTS.price * priceScore;
  if (Math.abs(diff) <= 0.15) {
    const pct = Math.round(diff * 100);
    reasons.push(pct === 0 ? "Same price range" : `Similar price (${pct > 0 ? "+" : ""}${pct}%)`);
  } else if (diff < -0.15) {
    reasons.push(`${Math.round(-diff * 100)}% cheaper`);
  }

  // Type
  if (p.type === base.type) score += WEIGHTS.type;

  // Size
  const sizeDiff = Math.abs(p.superBuiltUpArea - base.superBuiltUpArea) / base.superBuiltUpArea;
  score += WEIGHTS.size * Math.max(0, 1 - sizeDiff / 0.3);

  // Amenities (Jaccard)
  const a = new Set(base.amenities);
  const inter = p.amenities.filter((x) => a.has(x)).length;
  const union = new Set([...base.amenities, ...p.amenities]).size || 1;
  score += WEIGHTS.amenities * (inter / union);

  return { score: Math.round(score), reasons, distance: d };
}

export function recommend(base: Property, all: Property[], context?: Filters, limit = 8): Recommendation[] {
  const useContext = context && hasAnyCriteria(context);
  const scored: Recommendation[] = [];
  for (const p of all) {
    if (p.id === base.id || p.location.city !== base.location.city) continue;
    const s = similarity(base, p);
    const matchesSearch = useContext ? matches(p, context!) : false;
    let score = s.score;
    // Respect the visitor's search: homes that fit it rank higher, homes that break the budget drop.
    if (useContext) {
      if (matchesSearch) score += 12;
      if (context!.maxPrice && p.price > context!.maxPrice * 1.05) score -= 15;
    }
    if (score < 35) continue;
    const reasons = [...s.reasons];
    if (matchesSearch) reasons.unshift("Matches your search");
    scored.push({ property: p, score: Math.min(100, Math.round(score)), reasons: reasons.slice(0, 3), matchesSearch });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

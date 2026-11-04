import "server-only";
import fs from "node:fs";
import path from "node:path";
import { generateProperties } from "./seed";
import type { Property } from "./types";

let cache: Property[] | null = null;

/**
 * Property inventory. Uses data/properties.json when present (real inventory),
 * otherwise deterministic sample data. Swap this for a database query in production.
 */
export function getAllProperties(): Property[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "properties.json");
  if (fs.existsSync(file)) {
    cache = JSON.parse(fs.readFileSync(file, "utf8")) as Property[];
  } else {
    cache = generateProperties();
  }
  return cache;
}

export function getPropertyBySlug(slug: string): Property | undefined {
  return getAllProperties().find((p) => p.slug === slug);
}

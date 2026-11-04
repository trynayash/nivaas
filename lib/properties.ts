import "server-only";
import { cache } from "react";
import { listingStore } from "./listings/store";
import type { Property } from "./types";

/**
 * Published listings for the public site. `cache` de-duplicates calls within one request
 * (e.g. generateMetadata + the page), so each page hits the database once.
 */
export const getAllProperties = cache(async (): Promise<Property[]> => listingStore().list());

/** A listing by slug. Drafts are only returned when `includeDrafts` is set (admin preview). */
export const getPropertyBySlug = cache(async (slug: string, includeDrafts = false): Promise<Property | undefined> => {
  const p = await listingStore().getBySlug(slug);
  if (!p) return undefined;
  return p.published || includeDrafts ? p : undefined;
});

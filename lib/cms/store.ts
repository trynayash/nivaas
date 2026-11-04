import "server-only";
import { assertWritableFallback, hasDatabase } from "@/lib/db";
import { defaultPage, type Page } from "./schema";
import { jsonFileStorage } from "./storage/json-file";
import { postgresStorage } from "./storage/postgres";
import type { CmsDoc, CmsStorage } from "./storage/types";
import { normalizePage } from "./validate";

export type { CmsDoc } from "./storage/types";
export { RevisionConflict } from "./storage/types";

/** Postgres when DATABASE_URL is set; the JSON file in data/ otherwise (local development). */
export function cmsStorage(): CmsStorage {
  return hasDatabase() ? postgresStorage : jsonFileStorage;
}

/** Writes need a writable store; on Vercel without a database, say so clearly. */
function writable(): CmsStorage {
  if (!hasDatabase()) assertWritableFallback("CMS content");
  return cmsStorage();
}

/** Every page read is normalised, so malformed or older stored data can never break rendering. */
export async function getCmsDoc(): Promise<CmsDoc> {
  const doc = await cmsStorage().read();
  return {
    ...doc,
    draft: normalizePage(doc.draft),
    published: normalizePage(doc.published),
    history: doc.history.map((h) => ({ at: h.at, page: normalizePage(h.page) })),
  };
}

/**
 * The live page. On a read-only host without a database this falls back to the default page,
 * so public pages keep working (Studio saves still fail with a clear message).
 */
export async function getPublishedPage(): Promise<Page> {
  if (!hasDatabase() && process.env.VERCEL) return defaultPage();
  return normalizePage(await cmsStorage().readPublished());
}

/**
 * The published header, footer and theme only: what search and property pages wrap themselves in.
 * Keeps the landing page's body sections out of those pages' client payload.
 */
export async function getSiteChrome(): Promise<Page> {
  const page = await getPublishedPage();
  return { ...page, sections: page.sections.filter((s) => (s.type === "header" || s.type === "footer") && !s.hidden) };
}

export const saveDraft = (page: Page, expectedRev?: number) => writable().saveDraft(page, expectedRev);
export const publish = (page: Page, expectedRev?: number) => writable().publish(page, expectedRev);

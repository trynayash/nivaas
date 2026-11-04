import "server-only";
import { assertWritableFallback, hasDatabase } from "@/lib/db";
import type { Page } from "./schema";
import { jsonFileStorage } from "./storage/json-file";
import { postgresStorage } from "./storage/postgres";
import type { CmsStorage } from "./storage/types";

export type { CmsDoc } from "./storage/types";

/** Postgres when DATABASE_URL is set; the JSON file in data/ otherwise (local development). */
export function cmsStorage(): CmsStorage {
  if (hasDatabase()) return postgresStorage;
  assertWritableFallback("CMS content");
  return jsonFileStorage;
}

export const getCmsDoc = () => cmsStorage().read();
export const getPublishedPage = () => cmsStorage().readPublished();
export const saveDraft = (page: Page) => cmsStorage().saveDraft(page);
export const publish = (page: Page) => cmsStorage().publish(page);

export function isValidPage(p: unknown): p is Page {
  if (!p || typeof p !== "object") return false;
  const page = p as Page;
  return (
    page.version === 1 &&
    Array.isArray(page.sections) &&
    typeof page.theme === "object" &&
    page.sections.every((s) => s && typeof s.id === "string" && typeof s.type === "string")
  );
}

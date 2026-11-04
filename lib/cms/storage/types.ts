import type { Page } from "../schema";

export interface CmsVersion {
  at: string; // when this version was published
  page: Page;
}

export interface CmsDoc {
  draft: Page;
  published: Page;
  draftSavedAt: string | null;
  publishedAt: string | null;
  /** Previously published versions, newest first. */
  history: CmsVersion[];
}

/** Storage contract for CMS content. Implemented by the Postgres and JSON-file adapters. */
export interface CmsStorage {
  readonly name: "postgres" | "json-file";
  read(): Promise<CmsDoc>;
  /** Read only the published page (the hot path for public pages). */
  readPublished(): Promise<Page>;
  saveDraft(page: Page): Promise<{ draftSavedAt: string }>;
  /** Make `page` live, archiving the previously published version. */
  publish(page: Page): Promise<{ publishedAt: string }>;
}

export const MAX_VERSIONS = 15;

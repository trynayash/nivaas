import type { Page } from "../schema";

export interface CmsVersion {
  at: string; // when this version was published
  page: Page;
}

export interface CmsDoc {
  draft: Page;
  published: Page;
  draftSavedAt: string | null;
  /** Increments on every draft save/publish. Clients send the one they last saw. */
  draftRev: number;
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
  /** Save the draft. If `expectedRev` is given and the stored draft has moved on, throws RevisionConflict. */
  saveDraft(page: Page, expectedRev?: number): Promise<{ draftSavedAt: string; draftRev: number }>;
  /** Make `page` live, archiving the previously published version. Same revision check. */
  publish(page: Page, expectedRev?: number): Promise<{ publishedAt: string; draftRev: number }>;
}

export const MAX_VERSIONS = 15;

/** Someone (another tab, an older request) saved in between. */
export class RevisionConflict extends Error {
  code = "REVISION_CONFLICT";
  constructor(public currentRev: number) {
    super("This page was changed somewhere else (another tab or device). Reload to get the latest version.");
  }
}

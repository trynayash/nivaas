import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { Page, defaultPage } from "./schema";

/**
 * File-backed CMS store: a draft the editor autosaves to, the published page visitors see,
 * and the last 15 published versions. Swap for a database table in production
 * (serverless hosts have read-only/ephemeral file systems).
 */
export interface CmsDoc {
  draft: Page;
  published: Page;
  draftSavedAt: string | null;
  publishedAt: string | null;
  history: { at: string; page: Page }[];
}

const FILE = path.join(process.cwd(), "data", "cms.json");
const MAX_HISTORY = 15;

async function read(): Promise<CmsDoc> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as CmsDoc;
  } catch {
    const page = defaultPage();
    return { draft: page, published: page, draftSavedAt: null, publishedAt: null, history: [] };
  }
}

async function write(doc: CmsDoc) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2));
  await fs.rename(tmp, FILE);
}

export async function getCmsDoc() {
  return read();
}

export async function getPublishedPage(): Promise<Page> {
  return (await read()).published;
}

export async function saveDraft(page: Page) {
  const doc = await read();
  doc.draft = page;
  doc.draftSavedAt = new Date().toISOString();
  await write(doc);
  return doc;
}

export async function publish(page: Page) {
  const doc = await read();
  const now = new Date().toISOString();
  doc.history = [{ at: doc.publishedAt ?? now, page: doc.published }, ...doc.history].slice(0, MAX_HISTORY);
  doc.draft = page;
  doc.published = page;
  doc.draftSavedAt = now;
  doc.publishedAt = now;
  await write(doc);
  return doc;
}

export function isValidPage(p: unknown): p is Page {
  if (!p || typeof p !== "object") return false;
  const page = p as Page;
  return page.version === 1 && Array.isArray(page.sections) && typeof page.theme === "object" && page.sections.every((s) => s && typeof s.id === "string" && typeof s.type === "string");
}

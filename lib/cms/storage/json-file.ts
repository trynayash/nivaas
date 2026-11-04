import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultPage, type Page } from "../schema";
import { MAX_VERSIONS, type CmsDoc, type CmsStorage } from "./types";

/** Local-development fallback used when DATABASE_URL is not set. Not suitable for serverless hosts. */
const FILE = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "cms.json");

async function load(): Promise<CmsDoc> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as CmsDoc;
  } catch {
    const page = defaultPage();
    return { draft: page, published: page, draftSavedAt: null, publishedAt: null, history: [] };
  }
}

async function save(doc: CmsDoc) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2));
  await fs.rename(tmp, FILE);
}

// Serialise writes within this process so concurrent saves can't interleave read-modify-write.
let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

export const jsonFileStorage: CmsStorage = {
  name: "json-file",
  read: load,
  readPublished: async () => (await load()).published,
  saveDraft: (page: Page) =>
    serial(async () => {
      const doc = await load();
      doc.draft = page;
      doc.draftSavedAt = new Date().toISOString();
      await save(doc);
      return { draftSavedAt: doc.draftSavedAt };
    }),
  publish: (page: Page) =>
    serial(async () => {
      const doc = await load();
      const now = new Date().toISOString();
      doc.history = [{ at: doc.publishedAt ?? now, page: doc.published }, ...doc.history].slice(0, MAX_VERSIONS);
      doc.draft = page;
      doc.published = page;
      doc.draftSavedAt = now;
      doc.publishedAt = now;
      await save(doc);
      return { publishedAt: now };
    }),
};

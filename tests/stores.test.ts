// Storage adapters. The JSON-file adapters always run (temp directory). The Postgres adapters run
// when TEST_DATABASE_URL points at a disposable database — the tests drop and recreate its tables.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Property } from "@/lib/types";

async function freshModules() {
  vi.resetModules();
  const listings = await import("@/lib/listings/store");
  const enquiries = await import("@/lib/enquiries/store");
  const cms = await import("@/lib/cms/store");
  const schema = await import("@/lib/cms/schema");
  return { ...listings, ...enquiries, ...cms, defaultPage: schema.defaultPage };
}

function contract(name: string, setup: () => Promise<void>) {
  describe(name, () => {
    let m: Awaited<ReturnType<typeof freshModules>>;
    beforeAll(async () => {
      await setup();
      m = await freshModules();
    });

    it("seeds the sample listings once", async () => {
      const list = await m.listingStore().list();
      expect(list.length).toBe(177);
      expect(list.every((p) => p.isSample && p.published)).toBe(true);
      expect(await m.listingStore().counts()).toEqual({ total: 177, published: 177, samples: 177 });
    });

    it("saves, hides drafts, rejects duplicate slugs, deletes", async () => {
      const store = m.listingStore();
      const sample = (await store.list())[0];
      const mine: Property = { ...sample, id: "LTESTONE", slug: "test-listing-one", isSample: false, published: false, title: "Test listing" };
      await store.save(mine);
      expect((await store.list()).some((p) => p.id === "LTESTONE")).toBe(false);
      expect((await store.list({ includeDrafts: true })).some((p) => p.id === "LTESTONE")).toBe(true);
      expect((await store.getBySlug("test-listing-one"))?.title).toBe("Test listing");
      await expect(store.save({ ...mine, id: "LTESTTWO" })).rejects.toThrow(/already uses/);
      await store.save({ ...mine, published: true, price: 123_400_00 });
      expect((await store.get("LTESTONE"))?.price).toBe(12_340_000);
      expect(await store.remove("LTESTONE")).toBe(true);
      expect(await store.remove("LTESTONE")).toBe(false);
    });

    it("removes samples and never re-seeds them", async () => {
      const store = m.listingStore();
      const sample = (await store.list())[0];
      await store.save({ ...sample, id: "LKEEPME1", slug: "keep-me", isSample: false });
      expect(await store.removeSamples()).toBe(177);
      const fresh = await freshModules();
      const left = await fresh.listingStore().list({ includeDrafts: true });
      expect(left.map((p) => p.id)).toEqual(["LKEEPME1"]);
    });

    it("stores enquiries and updates their status", async () => {
      const e = await m.enquiryStore().create({ propertyId: "LKEEPME1", propertyTitle: "Keep", propertySlug: "keep-me", name: "Asha", phone: "+919876543210", email: null, message: "Call me", pageUrl: null });
      expect(await m.enquiryStore().countNew()).toBe(1);
      const u = await m.enquiryStore().update(e.id, { status: "contacted", note: "Sunday visit" });
      expect(u).toMatchObject({ status: "contacted", note: "Sunday visit" });
      expect(await m.enquiryStore().countNew()).toBe(0);
      expect(await m.enquiryStore().update("missing", { status: "closed" })).toBeUndefined();
    });

    it("refuses a listing save based on an out-of-date revision", async () => {
      const store = m.listingStore();
      const sample = (await store.list())[0];
      const first = await store.save({ ...sample, id: "LREVTEST", slug: "rev-test", isSample: false });
      const rev = first.rev!;
      const second = await store.save({ ...first, title: "Newer" }, rev);
      expect(second.rev).toBe(rev + 1);
      await expect(store.save({ ...first, title: "Stale" }, rev)).rejects.toBeInstanceOf(m.StaleListingError);
      expect((await store.get("LREVTEST"))?.title).toBe("Newer");
      await store.remove("LREVTEST");
    });

    it("refuses a CMS draft save or publish based on an out-of-date revision", async () => {
      const page = m.defaultPage();
      const { draftRev } = await m.getCmsDoc();
      const saved = await m.saveDraft({ ...page, title: "Tab one" }, draftRev);
      expect(saved.draftRev).toBe(draftRev + 1);
      await expect(m.saveDraft({ ...page, title: "Stale tab" }, draftRev)).rejects.toBeInstanceOf(m.RevisionConflict);
      await expect(m.publish({ ...page, title: "Stale publish" }, draftRev)).rejects.toBeInstanceOf(m.RevisionConflict);
      expect((await m.getCmsDoc()).draft.title).toBe("Tab one");
    });

    it("keeps draft and published CMS pages apart and caps history at 15", async () => {
      const page = m.defaultPage();
      await m.saveDraft({ ...page, title: "Draft only" });
      expect((await m.getPublishedPage()).title).not.toBe("Draft only");
      for (let i = 0; i < 17; i++) await m.publish({ ...page, title: `v${i}` });
      const doc = await m.getCmsDoc();
      expect(doc.published.title).toBe("v16");
      expect(doc.history.length).toBe(15);
      expect(doc.history[0].page.title).toBe("v15");
    });
  });
}

const origCwd = process.cwd();
let tmp = "";
contract("JSON-file adapters", async () => {
  delete process.env.DATABASE_URL;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nivaas-test-"));
  process.chdir(tmp);
});

const PG = process.env.TEST_DATABASE_URL;
if (PG) {
  contract("Postgres adapters", async () => {
    process.chdir(origCwd);
    process.env.DATABASE_URL = PG;
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: PG });
    await pool.query("drop table if exists cms_page_versions, cms_pages, properties, enquiries, app_meta cascade");
    await pool.end();
    (globalThis as { __nivaasSchema?: unknown; __nivaasSeeded?: unknown }).__nivaasSchema = undefined;
    (globalThis as { __nivaasSeeded?: unknown }).__nivaasSeeded = undefined;
  });
  describe("Postgres self-healing", () => {
    it("recreates tables and re-seeds after the database is reset under a running process", async () => {
      const m = await freshModules();
      await m.listingStore().list(); // warm the per-process caches
      const { pool } = await import("@/lib/db");
      await pool().query("drop table cms_page_versions, cms_pages, properties, enquiries, app_meta cascade");
      expect((await m.listingStore().list()).length).toBe(177);
      expect((await m.getPublishedPage()).version).toBe(1);
    });
  });
} else {
  describe.skip("Postgres adapters (set TEST_DATABASE_URL to run)", () => {
    it("skipped", () => {});
  });
}

afterAll(async () => {
  process.chdir(origCwd);
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  const g = globalThis as { __nivaasPool?: { end(): Promise<void> } };
  await g.__nivaasPool?.end();
});

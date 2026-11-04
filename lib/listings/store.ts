import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { assertWritableFallback, hasDatabase, iso, pool, tx, withSchema } from "@/lib/db";
import { generateProperties } from "@/lib/seed";
import type { Property } from "@/lib/types";

/** Storage contract for the property inventory. Postgres when DATABASE_URL is set, a JSON file otherwise. */
export interface ListingStore {
  readonly name: "postgres" | "json-file";
  /** Every listing, newest first. `includeDrafts` is for Studio only. */
  list(opts?: { includeDrafts?: boolean }): Promise<Property[]>;
  get(id: string): Promise<Property | undefined>;
  getBySlug(slug: string): Promise<Property | undefined>;
  /** Insert or replace. Fails with code "SLUG_TAKEN" if another listing already uses the slug. */
  save(p: Property): Promise<Property>;
  remove(id: string): Promise<boolean>;
  removeSamples(): Promise<number>;
  counts(): Promise<{ total: number; published: number; samples: number }>;
}

export class SlugTakenError extends Error {
  code = "SLUG_TAKEN";
  constructor(slug: string) {
    super(`Another listing already uses the address “${slug}”.`);
  }
}

const SEED_ENABLED = () => process.env.SEED_SAMPLE_LISTINGS !== "false";
const byNewest = (a: Property, b: Property) =>
  (b.createdAt ?? b.postedOn).localeCompare(a.createdAt ?? a.postedOn) || a.id.localeCompare(b.id);

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __nivaasSeeded?: Promise<void> };

/**
 * Insert the sample inventory exactly once per database. A marker in app_meta records that it
 * happened, so deleting the samples later does not bring them back on the next cold start.
 */
function ensureSeeded(): Promise<void> {
  if (!g.__nivaasSeeded) {
    g.__nivaasSeeded = tx(async (c) => {
      await c.query(`select pg_advisory_xact_lock(4207731)`); // one seeder at a time across instances
      const done = await c.query(`select 1 from app_meta where key = 'samples_seeded'`);
      if (done.rowCount) return;
      if (SEED_ENABLED()) {
        const samples = generateProperties();
        await c.query(
          `insert into properties (id, slug, data, published, is_sample, created_at, updated_at)
           select x->>'id', x->>'slug', x, (x->>'published')::boolean, true, (x->>'postedOn')::timestamptz, now()
             from jsonb_array_elements($1::jsonb) as x
           on conflict (id) do nothing`,
          [JSON.stringify(samples)]
        );
      }
      await c.query(`insert into app_meta (key, value) values ('samples_seeded', to_jsonb(now())) on conflict (key) do nothing`);
    }).catch((err) => {
      g.__nivaasSeeded = undefined;
      throw err;
    });
  }
  return g.__nivaasSeeded;
}

const run = <T,>(fn: () => Promise<T>) =>
  withSchema(async () => {
    await ensureSeeded();
    return fn();
  });

type Row = { data: Property; published: boolean; is_sample: boolean; created_at: Date; updated_at: Date };
const fromRow = (r: Row): Property => ({
  ...r.data,
  published: r.published,
  isSample: r.is_sample,
  createdAt: iso(r.created_at)!,
  updatedAt: iso(r.updated_at)!,
});
const COLS = `data, published, is_sample, created_at, updated_at`;

const postgresStore: ListingStore = {
  name: "postgres",

  list: (opts = {}) =>
    run(async () => {
      const { rows } = await pool().query<Row>(
        `select ${COLS} from properties ${opts.includeDrafts ? "" : "where published"} order by created_at desc, id`
      );
      return rows.map(fromRow);
    }),

  get: (id) =>
    run(async () => {
      const { rows } = await pool().query<Row>(`select ${COLS} from properties where id = $1`, [id]);
      return rows[0] ? fromRow(rows[0]) : undefined;
    }),

  getBySlug: (slug) =>
    run(async () => {
      const { rows } = await pool().query<Row>(`select ${COLS} from properties where slug = $1`, [slug]);
      return rows[0] ? fromRow(rows[0]) : undefined;
    }),

  save: (p) =>
    run(async () => {
      const { createdAt, updatedAt, ...data } = p;
      void updatedAt;
      try {
        const { rows } = await pool().query<Row>(
          `insert into properties (id, slug, data, published, is_sample, created_at, updated_at)
           values ($1, $2, $3::jsonb, $4, $5, coalesce($6::timestamptz, now()), now())
           on conflict (id) do update
             set slug = excluded.slug, data = excluded.data, published = excluded.published,
                 is_sample = excluded.is_sample, updated_at = now()
           returning ${COLS}`,
          [p.id, p.slug, JSON.stringify(data), p.published, p.isSample, createdAt ?? null]
        );
        return fromRow(rows[0]);
      } catch (err) {
        if ((err as { code?: string; constraint?: string }).code === "23505") throw new SlugTakenError(p.slug);
        throw err;
      }
    }),

  remove: (id) => run(async () => ((await pool().query(`delete from properties where id = $1`, [id])).rowCount ?? 0) > 0),

  removeSamples: () => run(async () => (await pool().query(`delete from properties where is_sample`)).rowCount ?? 0),

  counts: () =>
    run(async () => {
      const { rows } = await pool().query<{ total: string; published: string; samples: string }>(
        `select count(*) as total, count(*) filter (where published) as published, count(*) filter (where is_sample) as samples from properties`
      );
      return { total: +rows[0].total, published: +rows[0].published, samples: +rows[0].samples };
    }),
};

// ---------------------------------------------------------------------------
// JSON file (local development without a database)
// ---------------------------------------------------------------------------

const FILE = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "properties.json");
let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
  const r = queue.then(fn, fn);
  queue = r.catch(() => undefined);
  return r;
};

async function loadFile(): Promise<Property[]> {
  try {
    const list = JSON.parse(await fs.readFile(FILE, "utf8")) as Property[];
    return list.map((p) => ({ ...p, published: p.published ?? true, isSample: !!p.isSample }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const seeded = SEED_ENABLED() ? generateProperties() : [];
    try {
      await saveFile(seeded);
    } catch {
      // read-only file system: serve the generated samples without persisting them
    }
    return seeded;
  }
}

async function saveFile(list: Property[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 1));
  await fs.rename(tmp, FILE);
}

const jsonStore: ListingStore = {
  name: "json-file",
  list: async (opts = {}) => (await loadFile()).filter((p) => opts.includeDrafts || p.published).sort(byNewest),
  get: async (id) => (await loadFile()).find((p) => p.id === id),
  getBySlug: async (slug) => (await loadFile()).find((p) => p.slug === slug),
  save: (p) =>
    serial(async () => {
      const list = await loadFile();
      if (list.some((x) => x.slug === p.slug && x.id !== p.id)) throw new SlugTakenError(p.slug);
      const now = new Date().toISOString();
      const i = list.findIndex((x) => x.id === p.id);
      const saved = { ...p, createdAt: i >= 0 ? list[i].createdAt ?? p.createdAt ?? now : p.createdAt ?? now, updatedAt: now };
      if (i >= 0) list[i] = saved;
      else list.push(saved);
      await saveFile(list);
      return saved;
    }),
  remove: (id) =>
    serial(async () => {
      const list = await loadFile();
      const next = list.filter((p) => p.id !== id);
      await saveFile(next);
      return next.length !== list.length;
    }),
  removeSamples: () =>
    serial(async () => {
      const list = await loadFile();
      const next = list.filter((p) => !p.isSample);
      await saveFile(next);
      return list.length - next.length;
    }),
  counts: async () => {
    const list = await loadFile();
    return { total: list.length, published: list.filter((p) => p.published).length, samples: list.filter((p) => p.isSample).length };
  },
};

export function listingStore(): ListingStore {
  if (hasDatabase()) return postgresStore;
  return jsonStore;
}

/** Writes need a writable store; on Vercel without a database, say so clearly. */
export function writableListingStore(): ListingStore {
  if (!hasDatabase()) assertWritableFallback("listings");
  return listingStore();
}

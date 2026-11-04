import "server-only";
import { Pool, type PoolClient } from "pg";
import { defaultPage, type Page } from "../schema";
import { SCHEMA_SQL } from "./sql";
import { MAX_VERSIONS, type CmsDoc, type CmsStorage } from "./types";

const SLUG = "home";

// One pool per server instance (survives hot reloads in dev). Keep it small: on serverless every
// instance gets its own pool, so point DATABASE_URL at a pooled endpoint (Neon/Supabase pooler).
const g = globalThis as unknown as { __nivaasPool?: Pool; __nivaasReady?: Promise<void> };

function pool(): Pool {
  if (!g.__nivaasPool) {
    g.__nivaasPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    g.__nivaasPool.on("error", (err) => console.error("[nivaas] idle Postgres client error", err));
  }
  return g.__nivaasPool;
}

/** Create tables and the page row on first use in this process. */
function ready(): Promise<void> {
  if (!g.__nivaasReady) {
    const page = JSON.stringify(defaultPage());
    g.__nivaasReady = (async () => {
      await pool().query(SCHEMA_SQL);
      await pool().query(
        `insert into cms_pages (slug, draft, published) values ($1, $2::jsonb, $2::jsonb) on conflict (slug) do nothing`,
        [SLUG, page]
      );
    })().catch((err) => {
      g.__nivaasReady = undefined; // retry on the next request
      throw err;
    });
  }
  return g.__nivaasReady;
}

/**
 * Run `fn` with the schema in place. If the tables disappeared after this process created them
 * (database reset, branch switch), Postgres reports 42P01 — recreate them once and retry.
 */
async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  await ready();
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code !== "42P01") throw err;
    g.__nivaasReady = undefined;
    await ready();
    return fn();
  }
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (err) {
    await c.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

async function readDoc(): Promise<CmsDoc> {
  const [row, versions] = await Promise.all([
    pool().query<{ draft: Page; published: Page; draft_saved_at: Date | null; published_at: Date | null }>(
      `select draft, published, draft_saved_at, published_at from cms_pages where slug = $1`,
      [SLUG]
    ),
    pool().query<{ page: Page; published_at: Date }>(
      `select page, published_at from cms_page_versions where slug = $1 order by id desc limit $2`,
      [SLUG, MAX_VERSIONS]
    ),
  ]);
  const r = row.rows[0];
  return {
    draft: r.draft,
    published: r.published,
    draftSavedAt: iso(r.draft_saved_at),
    publishedAt: iso(r.published_at),
    history: versions.rows.map((v) => ({ at: iso(v.published_at)!, page: v.page })),
  };
}

async function publishPage(page: Page): Promise<{ publishedAt: string }> {
  return tx(async (c) => {
    // Lock the row so simultaneous publishes archive versions one after another.
    await c.query(`select 1 from cms_pages where slug = $1 for update`, [SLUG]);
    await c.query(
      `insert into cms_page_versions (slug, page, published_at)
       select slug, published, coalesce(published_at, now()) from cms_pages where slug = $1`,
      [SLUG]
    );
    const { rows } = await c.query<{ published_at: Date }>(
      `update cms_pages
          set draft = $2::jsonb, published = $2::jsonb, draft_saved_at = now(), published_at = now(), updated_at = now()
        where slug = $1
        returning published_at`,
      [SLUG, JSON.stringify(page)]
    );
    await c.query(
      `delete from cms_page_versions
        where slug = $1
          and id not in (select id from cms_page_versions where slug = $1 order by id desc limit $2)`,
      [SLUG, MAX_VERSIONS]
    );
    return { publishedAt: iso(rows[0].published_at)! };
  });
}

export const postgresStorage: CmsStorage = {
  name: "postgres",

  read: () => withSchema(readDoc),

  readPublished: () =>
    withSchema(async () => {
      const { rows } = await pool().query<{ published: Page }>(`select published from cms_pages where slug = $1`, [SLUG]);
      return rows[0].published;
    }),

  saveDraft: (page: Page) =>
    withSchema(async () => {
      const { rows } = await pool().query<{ draft_saved_at: Date }>(
        `update cms_pages set draft = $2::jsonb, draft_saved_at = now(), updated_at = now() where slug = $1 returning draft_saved_at`,
        [SLUG, JSON.stringify(page)]
      );
      return { draftSavedAt: iso(rows[0].draft_saved_at)! };
    }),

  publish: (page: Page) => withSchema(() => publishPage(page)),
};

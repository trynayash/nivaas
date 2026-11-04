import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolClient } from "pg";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

/** True when DATABASE_URL is set — every store then uses Postgres. */
export const hasDatabase = () => !!process.env.DATABASE_URL;

/** On Vercel the file system is read-only, so the JSON fallbacks can't be used. */
export function assertWritableFallback(what: string) {
  if (process.env.VERCEL) {
    throw new Error(`DATABASE_URL is not set. Vercel's file system is read-only, so ${what} must be stored in Postgres.`);
  }
}

// One pool per server instance (survives hot reloads in dev). Keep it small: on serverless every
// instance gets its own pool, so point DATABASE_URL at a pooled endpoint (Neon/Supabase pooler).
const g = globalThis as unknown as { __nivaasPool?: Pool; __nivaasSchema?: Promise<void> };

/**
 * pg currently treats sslmode=require/prefer/verify-ca as verify-full (full certificate check) and
 * warns that this will change to weaker libpq semantics in its next major version. Keep the strict,
 * secure behaviour explicitly (Neon/Supabase use publicly trusted certificates).
 */
export function connectionString(url = process.env.DATABASE_URL ?? "") {
  return url.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
}

export function pool(): Pool {
  if (!g.__nivaasPool) {
    g.__nivaasPool = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.PG_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    g.__nivaasPool.on("error", (err) => console.error("[nivaas] idle Postgres client error", err));
    // On Vercel, release idle connections before a function instance is suspended.
    if (process.env.VERCEL) attachDatabasePool(g.__nivaasPool);
  }
  return g.__nivaasPool;
}

// Per-process caches that depend on the tables (e.g. "samples already seeded") register here so
// they are cleared when the schema has to be recreated.
const resetHooks = new Set<() => void>();
export function onSchemaReset(fn: () => void) {
  resetHooks.add(fn);
}

/**
 * Apply the schema once per database version, not on every cold start: a cheap version check
 * first, then the DDL under an advisory lock so concurrent instances can't race each other.
 */
async function applySchema(force = false) {
  const current = await pool()
    .query<{ value: number }>(`select value from app_meta where key = 'schema_version'`)
    .then((r) => Number(r.rows[0]?.value ?? 0))
    .catch(() => 0); // app_meta missing → fresh database
  if (current >= SCHEMA_VERSION && !force) return;
  const c = await pool().connect();
  try {
    await c.query("select pg_advisory_lock(4207730)");
    await c.query(SCHEMA_SQL);
    await c.query(
      `insert into app_meta (key, value) values ('schema_version', to_jsonb($1::int))
       on conflict (key) do update set value = excluded.value`,
      [SCHEMA_VERSION]
    );
  } finally {
    await c.query("select pg_advisory_unlock(4207730)").catch(() => undefined);
    c.release();
  }
}

function ensureSchema(force = false): Promise<void> {
  if (!g.__nivaasSchema || force) {
    g.__nivaasSchema = applySchema(force).catch((err) => {
      g.__nivaasSchema = undefined; // retry on the next request
      throw err;
    });
  }
  return g.__nivaasSchema;
}

/**
 * Run `fn` with the schema in place. If tables disappeared after this process created them
 * (database reset, branch switch), Postgres reports 42P01 — recreate them once and retry.
 */
export async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  await ensureSchema();
  try {
    return await fn();
  } catch (err) {
    if ((err as { code?: string }).code !== "42P01") throw err;
    for (const fn of resetHooks) fn();
    await ensureSchema(true); // a table is missing even though the version says otherwise
    return fn();
  }
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
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

export const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Short, URL-safe random id with a prefix, e.g. "L7K2Q9MX". */
export function newId(prefix: string) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = prefix;
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

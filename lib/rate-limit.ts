// Fixed-window rate limiting. With DATABASE_URL the counters live in Postgres, so every serverless
// instance shares them (an in-memory map alone resets on each cold start). Without a database
// (local development) an in-memory map is used.
import { hasDatabase, pool, withSchema } from "./db";

type Result = { ok: boolean; retryAfter: number; count: number };

// --- In-memory fallback --------------------------------------------------------
const hits = new Map<string, { n: number; reset: number }>();
let lastSweep = 0;

function memoryHit(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  // Sweep expired keys at most once a minute (bounded work per request even under attack).
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return { ok: limit >= 1, retryAfter: Math.ceil(windowMs / 1000), count: 1 };
  }
  h.n++;
  return { ok: h.n <= limit, retryAfter: Math.ceil((h.reset - now) / 1000), count: h.n };
}

function memoryPeek(key: string): number {
  const h = hits.get(key);
  return h && h.reset >= Date.now() ? h.n : 0;
}

// --- Shared (Postgres) -----------------------------------------------------------
async function dbHit(key: string, limit: number, windowMs: number): Promise<Result> {
  const secs = Math.ceil(windowMs / 1000);
  const { rows } = await pool().query<{ count: number; retry: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning count, greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => $2) - now()))))::int as retry`,
    [key, secs]
  );
  // Occasionally clear out stale counters.
  if (Math.random() < 0.01) pool().query(`delete from rate_limits where window_start < now() - interval '1 day'`).catch(() => undefined);
  return { ok: rows[0].count <= limit, retryAfter: rows[0].retry, count: rows[0].count };
}

async function dbPeek(key: string, windowMs: number): Promise<number> {
  const { rows } = await pool().query<{ count: number }>(
    `select count from rate_limits where key = $1 and window_start >= now() - make_interval(secs => $2)`,
    [key, Math.ceil(windowMs / 1000)]
  );
  return rows[0]?.count ?? 0;
}

/** Count one hit against `key`; `ok` is false once more than `limit` hits fall in the window. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<Result> {
  if (!hasDatabase()) return memoryHit(key, limit, windowMs);
  try {
    return await withSchema(() => dbHit(key, limit, windowMs));
  } catch (err) {
    console.error("[nivaas] rate limiter unavailable, using memory:", (err as Error).message);
    return memoryHit(key, limit, windowMs);
  }
}

/** How many hits `key` has in the current window, without counting a new one. */
export async function peekLimit(key: string, windowMs: number): Promise<number> {
  if (!hasDatabase()) return memoryPeek(key);
  try {
    return await withSchema(() => dbPeek(key, windowMs));
  } catch {
    return memoryPeek(key);
  }
}

/**
 * The visitor's IP. On Vercel the platform sets x-forwarded-for itself, so it can be trusted;
 * elsewhere (`next start` without a proxy) the client controls it, so don't. IPv6 addresses are
 * grouped by /64, because one user typically owns a whole /64.
 */
export function clientIp(req: Request): string {
  const raw = process.env.VERCEL ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") : null;
  if (!raw) return "local";
  if (raw.includes(":")) return raw.split(":").slice(0, 4).join(":") + "::/64";
  return raw;
}

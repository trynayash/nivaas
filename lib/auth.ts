import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hasDatabase, onSchemaReset, pool, withSchema } from "./db";

export const ADMIN_COOKIE = "nv_admin";
export const SESSION_HOURS = 12;

/** The admin password comes from the environment only. There is no built-in default. */
export const adminPassword = () => process.env.ADMIN_PASSWORD?.trim() || null;
export const adminConfigured = () => adminPassword() !== null;

/**
 * Key that signs session cookies — never derived from the password. In order of preference:
 * SESSION_SECRET if set; otherwise a random key generated once and kept in the database
 * (app_meta); without a database (local development), a random per-process key.
 */
const g = globalThis as unknown as { __nivaasKey?: Promise<string>; __nivaasDevSessions?: Map<string, number> };

async function loadKey(): Promise<string> {
  const env = process.env.SESSION_SECRET?.trim();
  if (env) return env;
  if (!hasDatabase()) return randomBytes(32).toString("hex");
  return withSchema(async () => {
    const fresh = randomBytes(32).toString("hex");
    // First writer wins; everyone then reads the same key.
    await pool().query(`insert into app_meta (key, value) values ('session_key', to_jsonb($1::text)) on conflict (key) do nothing`, [fresh]);
    const { rows } = await pool().query<{ value: string }>(`select value from app_meta where key = 'session_key'`);
    return rows[0].value;
  });
}

onSchemaReset(() => {
  g.__nivaasKey = undefined; // the key row may have been recreated
});

function key(): Promise<string> {
  g.__nivaasKey ??= loadKey().catch((err) => {
    g.__nivaasKey = undefined;
    throw err;
  });
  return g.__nivaasKey;
}

const sign = async (data: string) => createHmac("sha256", await key()).update(data).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: unknown) {
  const expected = adminPassword();
  if (!expected || typeof input !== "string") return false;
  const a = createHmac("sha256", "pw").update(input).digest();
  const b = createHmac("sha256", "pw").update(expected).digest();
  return timingSafeEqual(a, b);
}

// --- Session store: Postgres when available, memory in development --------------------------

const devSessions = () => (g.__nivaasDevSessions ??= new Map());

async function storeSession(id: string, expires: Date) {
  if (!hasDatabase()) {
    devSessions().set(id, expires.getTime());
    return;
  }
  await withSchema(async () => {
    await pool().query(`insert into admin_sessions (id, expires_at) values ($1, $2)`, [id, expires]);
    await pool().query(`delete from admin_sessions where expires_at < now()`);
  });
}

async function sessionAlive(id: string): Promise<boolean> {
  if (!hasDatabase()) return (devSessions().get(id) ?? 0) > Date.now();
  return withSchema(async () => {
    const { rowCount } = await pool().query(`select 1 from admin_sessions where id = $1 and expires_at > now()`, [id]);
    return (rowCount ?? 0) > 0;
  });
}

async function dropSession(id: string) {
  if (!hasDatabase()) {
    devSessions().delete(id);
    return;
  }
  await withSchema(() => pool().query(`delete from admin_sessions where id = $1`, [id]));
}

/** Start a session: random id, server-side expiry, signed cookie value `id.expires.signature`. */
export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const id = randomBytes(24).toString("base64url");
  const maxAge = SESSION_HOURS * 3600;
  const expires = new Date(Date.now() + maxAge * 1000);
  await storeSession(id, expires);
  const payload = `${id}.${expires.getTime()}`;
  return { value: `${payload}.${await sign(payload)}`, maxAge };
}

async function parseCookie(value: string | undefined): Promise<{ id: string; expires: number } | null> {
  if (!value || value.length > 200) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!safeEqual(sig, await sign(`${id}.${exp}`))) return null;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  return { id, expires };
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  try {
    const s = await parseCookie((await cookies()).get(ADMIN_COOKIE)?.value);
    if (!s) return false;
    return await sessionAlive(s.id);
  } catch (err) {
    console.error("[nivaas] session check failed:", (err as Error).message);
    return false;
  }
}

/** Revoke the current session on the server (the cookie is cleared by the caller). */
export async function endSession(cookieValue: string | undefined) {
  const s = await parseCookie(cookieValue).catch(() => null);
  if (s) await dropSession(s.id).catch(() => undefined);
}

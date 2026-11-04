// Incoming text can carry invisible control characters (e.g. pasted from Word/PDF). Postgres
// rejects NUL (\u0000) outright, which would turn a normal save into a 500, and the others are
// never meaningful in this app. Strip them from every string, keeping tabs and newlines.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanString(s: string): string {
  return s.replace(CONTROL, "");
}

/** Deep-clean every string in a JSON-like value (objects, arrays, primitives). */
export function sanitize<T>(value: T, depth = 0): T {
  if (depth > 40) return value;
  if (typeof value === "string") return cleanString(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[cleanString(k)] = sanitize(v, depth + 1);
    return out as T;
  }
  return value;
}

/** Ids and slugs we generate are short and plain; anything else can't exist, so don't query for it. */
export const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const SLUG_RE = /^[a-z0-9-]{1,200}$/;

/** Read a JSON body and sanitize it. Returns null for missing/invalid JSON. */
export async function readJson(req: Request): Promise<unknown> {
  const body = await req.json().catch(() => null);
  return body === null ? null : sanitize(body);
}

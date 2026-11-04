// Browser-side JSON requests for Studio. Never throws: network failures, non-JSON bodies and
// error statuses all come back as { ok: false, status, error } with a message fit to show.

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; data: Record<string, unknown> };

export async function api<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, error: "No connection — check your internet and try again.", data: {} };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, status: res.status, data: data as T };
  const error =
    res.status === 401
      ? "Your session has ended. Log in again in a new tab, then retry."
      : typeof data.error === "string"
        ? data.error
        : res.status === 429
          ? "Too many attempts. Please wait a few minutes."
          : "Something went wrong. Please try again.";
  return { ok: false, status: res.status, error, data };
}

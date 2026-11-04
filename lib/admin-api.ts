import "server-only";
import { NextResponse } from "next/server";
import { isAdmin } from "./auth";

/** Same-origin check for state-changing requests (CSRF defence on top of the SameSite cookie). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET" || req.method === "HEAD";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Returns an error response if the request is not from a signed-in admin on this site, else null. */
export async function guardAdmin(req: Request): Promise<NextResponse | null> {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  return null;
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Turn unexpected errors into a 500 with a short message, and log the details. */
export function serverError(err: unknown, where: string) {
  console.error(`[nivaas] ${where}:`, err);
  const message = err instanceof Error && /DATABASE_URL/.test(err.message) ? err.message : "Something went wrong on the server. Please try again.";
  return NextResponse.json({ error: message }, { status: 500 });
}

import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/admin-api";
import { ADMIN_COOKIE, adminConfigured, checkPassword, sessionToken } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: "ADMIN_PASSWORD is not set" }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  // Slow down password guessing: 10 attempts per 15 minutes per address.
  const limit = rateLimit(`login:${clientIp(req)}`, 10, 15 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} min.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }
  const body = await req.json().catch(() => ({}));
  if (typeof body.password !== "string" || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

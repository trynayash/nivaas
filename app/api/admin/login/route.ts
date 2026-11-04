import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/admin-api";
import { ADMIN_COOKIE, adminConfigured, checkPassword, createSession } from "@/lib/auth";
import { clientIp, peekLimit, rateLimit } from "@/lib/rate-limit";

const WINDOW = 15 * 60_000;

export async function POST(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: "ADMIN_PASSWORD is not set" }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });

  const tooMany = (retryAfter: number) =>
    NextResponse.json({ error: `Too many attempts. Try again in ${Math.max(1, Math.ceil(retryAfter / 60))} min.` }, { status: 429, headers: { "retry-after": String(retryAfter) } });

  // Per address: 10 attempts per 15 minutes. Across all addresses: 100 failed attempts per
  // 15 minutes (stops slow guessing from many IPs). Both are shared by every server instance.
  if ((await peekLimit("login:fail:all", WINDOW)) >= 100) return tooMany(WINDOW / 1000);
  const perIp = await rateLimit(`login:${clientIp(req)}`, 10, WINDOW);
  if (!perIp.ok) return tooMany(perIp.retryAfter);

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  if (!checkPassword(body?.password)) {
    await rateLimit("login:fail:all", Number.MAX_SAFE_INTEGER, WINDOW);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const session = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}

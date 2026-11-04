import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, checkPassword, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: "ADMIN_PASSWORD is not set" }, { status: 503 });
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

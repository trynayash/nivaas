import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sameOrigin } from "@/lib/admin-api";
import { ADMIN_COOKIE, endSession } from "@/lib/auth";

/** Sign out: revoke the session on the server, then clear the cookie. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  await endSession((await cookies()).get(ADMIN_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "nv_admin";

/** The admin password comes from the environment only. There is no built-in default. */
export const adminPassword = () => process.env.ADMIN_PASSWORD?.trim() || null;
export const adminConfigured = () => adminPassword() !== null;

// Sessions are signed with SESSION_SECRET, or a key derived from the password
// (changing the password then signs everyone out).
const secret = () => process.env.SESSION_SECRET || createHmac("sha256", "nivaas-session").update(adminPassword() ?? "").digest("hex");

export function sessionToken() {
  return createHmac("sha256", secret()).update("admin-session-v1").digest("hex");
}

export function checkPassword(input: string) {
  const expected = adminPassword();
  if (!expected) return false;
  const a = createHmac("sha256", "pw").update(input).digest();
  const b = createHmac("sha256", "pw").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const expected = sessionToken();
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

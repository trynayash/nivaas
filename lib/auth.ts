import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "nv_admin";

const password = () => process.env.ADMIN_PASSWORD || "admin";
const secret = () => process.env.SESSION_SECRET || `nivaas-dev-secret:${password()}`;

export function sessionToken() {
  return createHmac("sha256", secret()).update("admin-session-v1").digest("hex");
}

export function checkPassword(input: string) {
  const a = Buffer.from(createHmac("sha256", "pw").update(input).digest("hex"));
  const b = Buffer.from(createHmac("sha256", "pw").update(password()).digest("hex"));
  return timingSafeEqual(a, b);
}

export async function isAdmin() {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const expected = sessionToken();
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export const usingDefaultPassword = () => !process.env.ADMIN_PASSWORD;

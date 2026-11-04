import { describe, expect, it } from "vitest";
import { normalizeWhatsApp, resolveContactHref, waLink } from "@/lib/contact";
import { enquirySchema, normalizePhone } from "@/lib/enquiries/input";
import { rateLimit } from "@/lib/rate-limit";

describe("WhatsApp", () => {
  it.each([
    ["9561713120", "919561713120"],
    ["+91 95617 13120", "919561713120"],
    ["09561713120", "919561713120"],
    ["12", null],
    ["", null],
  ])("normalizes %s", (raw, out) => expect(normalizeWhatsApp(raw)).toBe(out));

  it("turns #contact into a wa.me link only when a number is set", () => {
    expect(resolveContactHref("#contact", { whatsapp: "919561713120", message: "Hi there" })).toEqual({
      href: waLink("919561713120", "Hi there"),
      external: true,
    });
    expect(resolveContactHref("#contact", { whatsapp: null, message: "x" })).toEqual({ href: "#contact", external: false });
    expect(resolveContactHref("/search", { whatsapp: "919561713120", message: "x" }).href).toBe("/search");
  });
});

describe("enquiries", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["098765 43210", "+919876543210"],
    ["+44 20 7946 0958", "+442079460958"],
    ["12345", null],
    ["5876543210", null], // Indian mobiles start 6–9
  ])("phone %s", (raw, out) => expect(normalizePhone(raw)).toBe(out));

  it("validates the form", () => {
    const bad = enquirySchema.safeParse({ name: "R", phone: "123", message: "" });
    expect(bad.success).toBe(false);
    const good = enquirySchema.safeParse({ name: "Rahul Patil", phone: "98765 43210", message: "Please call me" });
    expect(good.success && good.data.phone).toBe("+919876543210");
  });
});

describe("rateLimit", () => {
  it("allows the limit then blocks", () => {
    const key = `t-${Math.random()}`;
    const results = Array.from({ length: 4 }, () => rateLimit(key, 3, 60_000).ok);
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("database URL", () => {
  it("keeps strict SSL verification explicit", async () => {
    const { connectionString } = await import("@/lib/db");
    expect(connectionString("postgres://u:p@h/db?sslmode=require")).toBe("postgres://u:p@h/db?sslmode=verify-full");
    expect(connectionString("postgres://u:p@h/db?channel_binding=require&sslmode=require")).toBe("postgres://u:p@h/db?channel_binding=require&sslmode=verify-full");
    expect(connectionString("postgres://u:p@localhost/db")).toBe("postgres://u:p@localhost/db");
  });
});

import { describe, expect, it } from "vitest";
import { ID_RE, SLUG_RE, sanitize } from "@/lib/sanitize";

describe("sanitize", () => {
  it("strips control characters (incl. NUL) but keeps tabs and newlines", () => {
    expect(sanitize("a\u0000b\u0007c\td\ne")).toBe("abc\td\ne");
  });
  it("cleans nested objects and arrays, keys included", () => {
    expect(sanitize({ "k\u0000": ["x\u0000", { y: "z\u001f" }], n: 5, b: true, nil: null })).toEqual({ k: ["x", { y: "z" }], n: 5, b: true, nil: null });
  });
  it("validates ids and slugs", () => {
    expect(ID_RE.test("LQFT6PMGP")).toBe(true);
    expect(ID_RE.test("NV1001")).toBe(true);
    expect(ID_RE.test("a\u0000")).toBe(false);
    expect(ID_RE.test("../x")).toBe(false);
    expect(SLUG_RE.test("3-bhk-villa-beach-road-madhli-aai-nv1089")).toBe(true);
    expect(SLUG_RE.test("\u0000")).toBe(false);
  });
});

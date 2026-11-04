import { describe, expect, it } from "vitest";
import { SAFE_NAME, sniffImage } from "@/lib/uploads";

describe("uploads", () => {
  it("detects real image types from bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.type).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))?.type).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImage(webp)?.type).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("only serves safe file names", () => {
    expect(SAFE_NAME.test("pABCDEF12.jpg")).toBe(true);
    expect(SAFE_NAME.test("../../etc/passwd")).toBe(false);
    expect(SAFE_NAME.test("x.svg")).toBe(false);
  });
});

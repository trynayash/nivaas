import { describe, expect, it } from "vitest";
import { CRORE, LAKH, floorLabel, formatPrice } from "@/lib/format";

describe("formatPrice", () => {
  it("uses lakh and crore the way Indian listings do", () => {
    expect(formatPrice(85 * LAKH)).toBe("₹85 L");
    expect(formatPrice(8.5 * LAKH)).toBe("₹8.5 L");
    expect(formatPrice(1.25 * CRORE)).toBe("₹1.25 Cr");
    expect(formatPrice(12.5 * CRORE)).toBe("₹12.5 Cr");
    expect(formatPrice(CRORE)).toBe("₹1 Cr");
  });
  it("never shows ₹100 L", () => {
    expect(formatPrice(99.75 * LAKH)).toBe("₹1 Cr");
    expect(formatPrice(99.4 * LAKH)).toBe("₹99 L");
  });
});

describe("floorLabel", () => {
  it("describes what is known", () => {
    expect(floorLabel(3, 12)).toBe("3 of 12");
    expect(floorLabel(0, 4)).toBe("Ground floor of 4");
    expect(floorLabel(3)).toBe("Floor 3");
    expect(floorLabel(0)).toBe("Ground floor");
    expect(floorLabel(undefined, 2)).toBe("2 storeys");
    expect(floorLabel(undefined, 1)).toBe("1 storey");
    expect(floorLabel()).toBeNull();
  });
});

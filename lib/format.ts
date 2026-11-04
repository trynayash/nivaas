export const LAKH = 100_000;
export const CRORE = 10_000_000;

/** ₹85 L / ₹1.25 Cr */
export function formatPrice(n: number): string {
  // Values that round to 100 L (e.g. ₹99.75 L) are shown in crores, never as "₹100 L".
  if (n >= CRORE || (n >= 10 * LAKH && Math.round(n / LAKH) >= 100)) {
    const v = n / CRORE;
    return `₹${trim(v >= 10 ? v.toFixed(1) : v.toFixed(2))} Cr`;
  }
  if (n >= LAKH) {
    const v = n / LAKH;
    return `₹${trim(v >= 10 ? v.toFixed(0) : v.toFixed(1))} L`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

function trim(s: string) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export const formatNumber = (n: number) => n.toLocaleString("en-IN");

export function formatSqft(n: number) {
  return `${formatNumber(Math.round(n))} sq.ft`;
}

export function bhkLabel(bhk: number, type?: string) {
  if (type === "Plot" || bhk === 0) return "Plot";
  return `${bhk} BHK`;
}

export function emi(principal: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 12 / 100;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export const cx = (...c: (string | number | boolean | null | undefined)[]) => c.filter((x) => typeof x === "string" && x).join(" ");

/** "3 of 12", "Floor 3", "12 storeys" — or null when nothing is known. */
export function floorLabel(floor?: number, totalFloors?: number): string | null {
  if (floor !== undefined && totalFloors !== undefined) return `${floor === 0 ? "Ground floor" : floor} of ${totalFloors}`;
  if (floor !== undefined) return floor === 0 ? "Ground floor" : `Floor ${floor}`;
  if (totalFloors !== undefined) return `${totalFloors} storey${totalFloors === 1 ? "" : "s"}`;
  return null;
}

export const LAKH = 100_000;
export const CRORE = 10_000_000;

/** ₹85 L / ₹1.25 Cr */
export function formatPrice(n: number): string {
  if (n >= CRORE) {
    const v = n / CRORE;
    return `₹${trim(v >= 10 ? v.toFixed(1) : v.toFixed(2))} Cr`;
  }
  if (n >= LAKH) {
    const v = n / LAKH;
    return `₹${trim(v >= 10 ? v.toFixed(0) : v.toFixed(1))} L`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Short form used in labels: "1 Cr", "80 L" */
export function formatPriceShort(n: number): string {
  return formatPrice(n).replace("₹", "₹");
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

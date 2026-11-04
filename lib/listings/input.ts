// What Studio's listing form submits, validated with zod on both the client and the server, and
// converted into a full Property. The location must exist in the city → locality → area hierarchy.
import { z } from "zod";
import { CITIES, getCity, slugify } from "@/lib/locations";
import { ALL_AMENITIES, FURNISHINGS, PROPERTY_TYPES, type Property } from "@/lib/types";

export const FACINGS = ["East", "North-East", "North", "North-West", "West", "South-West", "South", "South-East"] as const;
export const OWNERSHIPS = ["Freehold", "Leasehold", "Co-operative Society"] as const;
export const STATUSES = ["Ready to Move", "Under Construction"] as const;
export const MAX_IMAGES = 20;

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const optNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(min).max(max).optional());
const num = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : Number(v)),
    z.number({ message: `Enter ${label}.` }).refine((n) => Number.isFinite(n), `Enter ${label}.`).pipe(z.number().min(min, `${label} looks too small.`).max(max, `${label} looks too large.`))
  );
const lines = (maxItems: number, maxLen: number) =>
  z.array(text(maxLen)).max(maxItems).transform((a) => a.map((s) => s.trim()).filter(Boolean));

const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => /^https:\/\/[^\s]+$/.test(u) || /^\/api\/uploads\/[A-Za-z0-9._-]+$/.test(u), "Photos must be uploaded files.");

const baseSchema = z.object({
    title: text(140).optional().default(""),
    type: z.enum(PROPERTY_TYPES as [string, ...string[]]),
    bhk: num(0, 10, "the number of bedrooms"),
    bathrooms: num(0, 15, "the number of bathrooms"),
    balconies: num(0, 15, "the number of balconies"),
    projectName: text(100).min(1, "Enter the project or building name."),
    developer: text(100).min(1, "Enter the developer, or “Owner (resale)”."),
    description: text(3000).min(20, "Write at least a sentence about the home."),
    highlights: lines(8, 140),
    featured: z.boolean().default(false),
    published: z.boolean().default(false),

    city: z.string().min(1, "Choose a city."),
    locality: z.string().min(1, "Choose a locality."),
    area: z.string().min(1, "Choose an area."),
    address: text(240).min(5, "Enter the address."),
    pincode: z.string().trim().regex(/^\d{6}$/, "Pincode is 6 digits."),

    price: num(100_000, 10_000_000_000, "the price"),
    carpetArea: optNum(50, 100_000),
    builtUpArea: optNum(50, 100_000),
    superBuiltUpArea: optNum(50, 100_000),
    plotArea: optNum(100, 5_000_000),

    floor: optNum(-2, 200),
    totalFloors: optNum(1, 200),
    facing: z.enum(FACINGS),
    furnishing: z.enum(FURNISHINGS as [string, ...string[]]),
    status: z.enum(STATUSES),
    possession: text(40).min(1, "Enter “Immediate” or a month, e.g. Dec 2027."),
    ageYears: optNum(0, 150),

    reraApplicable: z.boolean(),
    reraNumber: text(80).optional().default(""),
    reraNote: text(300).optional().default(""),

    amenities: z.array(z.string()).max(60).transform((a) => [...new Set(a.filter((x) => ALL_AMENITIES.includes(x)))]),
    parkingCovered: num(0, 20, "covered parking"),
    parkingOpen: num(0, 20, "open parking"),
    maintenancePerMonth: num(0, 1_000_000, "maintenance"),
    ownership: z.enum(OWNERSHIPS),
    overlooking: lines(6, 40),
    flooring: text(80).optional().default(""),
    waterSupply: text(80).optional().default(""),
    powerBackup: text(80).optional().default(""),
    gatedCommunity: z.boolean(),
    approvedBanks: lines(15, 60),
    nearby: z
      .array(z.object({ kind: text(30).min(1), name: text(80).min(1), distanceKm: num(0, 500, "the distance") }))
      .max(12),
    images: z.array(imageUrl).max(MAX_IMAGES, `Up to ${MAX_IMAGES} photos.`),
});

type Cross = {
  type: string; bhk: unknown; city: string; locality: string; area: string; plotArea?: unknown; carpetArea?: unknown;
  builtUpArea?: unknown; superBuiltUpArea?: unknown; floor?: unknown; totalFloors?: unknown;
  reraApplicable: boolean; reraNumber?: string; reraNote?: string;
};
const n = (x: unknown) => (x === "" || x === null || x === undefined || Number.isNaN(Number(x)) ? undefined : Number(x));

/** Rules that span several fields. Runs on raw form values too, so every error shows at once. */
function crossCheck(raw: Cross, add: (path: string, message: string) => void) {
  const v = {
    ...raw,
    bhk: n(raw.bhk) ?? 0,
    plotArea: n(raw.plotArea),
    carpetArea: n(raw.carpetArea),
    builtUpArea: n(raw.builtUpArea),
    superBuiltUpArea: n(raw.superBuiltUpArea),
    floor: n(raw.floor),
    totalFloors: n(raw.totalFloors),
    reraNumber: (raw.reraNumber ?? "").trim(),
    reraNote: (raw.reraNote ?? "").trim(),
  };
    const city = getCity(v.city);
    const loc = city?.localities.find((l) => l.slug === v.locality);
    if (!city) add("city", "Choose a city.");
    else if (!loc) add("locality", "Choose a locality in this city.");
    else if (!loc.areas.some((a) => a.slug === v.area)) add("area", "Choose an area in this locality.");

    const isPlot = v.type === "Plot";
    if (isPlot) {
      if (!v.plotArea) add("plotArea", "Enter the plot area.");
    } else {
      if (v.bhk < 1) add("bhk", "Choose 1 BHK or more (use type “Plot” for land).");
      if (!v.carpetArea) add("carpetArea", "Enter the carpet area.");
      if (!v.superBuiltUpArea) add("superBuiltUpArea", "Enter the super built-up area.");
      if (v.carpetArea && v.superBuiltUpArea && v.carpetArea > v.superBuiltUpArea) add("carpetArea", "Carpet area can’t be larger than super built-up area.");
      if (v.carpetArea && v.builtUpArea && v.carpetArea > v.builtUpArea) add("builtUpArea", "Built-up area is usually larger than carpet area.");
      if (v.floor !== undefined && v.totalFloors !== undefined && v.floor > v.totalFloors) add("floor", "Floor is higher than the number of floors.");
    }
    if (v.reraApplicable && !v.reraNumber) add("reraNumber", "Enter the RERA registration number, or mark RERA as not applicable.");
    if (!v.reraApplicable && !v.reraNote) add("reraNote", "Say why RERA doesn’t apply (e.g. resale completed before 2017).");
  }

export const listingInputSchema = baseSchema.superRefine((v, ctx) =>
  crossCheck(v, (path, message) => ctx.addIssue({ code: "custom", path: [path], message }))
);

export type ListingInput = z.input<typeof listingInputSchema>;
export type ListingData = z.output<typeof listingInputSchema>;

/** Validate form values and return every field error at once (base rules + cross-field rules). */
export function validateListing(input: ListingInput): { ok: true; data: ListingData } | { ok: false; errors: Record<string, string> } {
  const r = listingInputSchema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors = fieldErrors(r.error);
  crossCheck(input as unknown as Cross, (path, message) => {
    if (!errors[path]) errors[path] = message;
  });
  return { ok: false, errors };
}

/** Field → first error message, for showing next to form fields. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function typeLabel(type: string, bhk: number) {
  return type === "Plot" ? "Residential Plot" : `${bhk} BHK ${type}`;
}

/** Build the stored Property from validated form data. `existing` keeps id, slug and history stable. */
export function toProperty(v: ListingData, opts: { id: string; existing?: Property; now?: Date }): Property {
  const city = getCity(v.city)!;
  const loc = city.localities.find((l) => l.slug === v.locality)!;
  const area = loc.areas.find((a) => a.slug === v.area)!;
  const isPlot = v.type === "Plot";
  const existing = opts.existing;
  const now = opts.now ?? new Date();
  const autoTitle = `${typeLabel(v.type, v.bhk)} in ${area.name}, ${loc.name}`;
  const size = isPlot ? v.plotArea! : v.superBuiltUpArea!;

  return {
    id: opts.id,
    // Keep the address stable once a listing exists, so shared links keep working.
    slug: existing?.slug ?? slugify(`${typeLabel(v.type, v.bhk)} ${area.name} ${loc.name} ${opts.id}`),
    title: v.title || autoTitle,
    projectName: v.projectName,
    developer: v.developer,
    type: v.type as Property["type"],
    bhk: isPlot ? 0 : v.bhk,
    bathrooms: isPlot ? 0 : v.bathrooms,
    balconies: isPlot ? 0 : v.balconies,
    price: Math.round(v.price),
    carpetArea: isPlot ? size : v.carpetArea!,
    builtUpArea: isPlot ? size : v.builtUpArea ?? Math.round(v.superBuiltUpArea! * 0.86),
    superBuiltUpArea: size,
    plotArea: v.plotArea,
    location: {
      city: city.slug,
      cityName: city.name,
      locality: loc.slug,
      localityName: loc.name,
      area: area.slug,
      areaName: area.name,
      address: v.address,
      pincode: v.pincode,
      lat: area.lat,
      lng: area.lng,
    },
    floor: isPlot ? undefined : v.floor,
    totalFloors: isPlot ? undefined : v.totalFloors,
    facing: v.facing,
    furnishing: v.furnishing as Property["furnishing"],
    status: v.status,
    possession: v.possession,
    ageYears: v.status === "Ready to Move" ? v.ageYears : undefined,
    rera: v.reraApplicable
      ? { applicable: true, number: v.reraNumber, authority: city.rera.authority, website: city.rera.website }
      : { applicable: false, authority: city.rera.authority, website: city.rera.website, note: v.reraNote },
    amenities: v.amenities,
    parking: { covered: v.parkingCovered, open: v.parkingOpen },
    maintenancePerMonth: v.maintenancePerMonth,
    ownership: v.ownership,
    overlooking: v.overlooking,
    flooring: v.flooring || "—",
    waterSupply: v.waterSupply || "—",
    powerBackup: v.powerBackup || "—",
    gatedCommunity: v.gatedCommunity,
    nearby: v.nearby,
    approvedBanks: v.approvedBanks,
    description: v.description,
    highlights: v.highlights,
    images: v.images,
    postedOn: existing?.postedOn ?? now.toISOString().slice(0, 10),
    featured: v.featured,
    hue: existing?.hue ?? [18, 28, 145, 160, 34][now.getTime() % 5],
    isSample: existing?.isSample ?? false,
    published: v.published,
    createdAt: existing?.createdAt,
  };
}

/** Form values for an existing listing (or sensible blanks for a new one). */
export function toInput(p?: Property): ListingInput {
  const firstCity = CITIES[0];
  if (!p) {
    return {
      title: "",
      type: "Apartment",
      bhk: 2,
      bathrooms: 2,
      balconies: 1,
      projectName: "",
      developer: "",
      description: "",
      highlights: [],
      featured: false,
      published: false,
      city: firstCity.slug,
      locality: "",
      area: "",
      address: "",
      pincode: "",
      price: "" as unknown as number,
      carpetArea: undefined,
      builtUpArea: undefined,
      superBuiltUpArea: undefined,
      plotArea: undefined,
      floor: undefined,
      totalFloors: undefined,
      facing: "East",
      furnishing: "Unfurnished",
      status: "Ready to Move",
      possession: "Immediate",
      ageYears: undefined,
      reraApplicable: true,
      reraNumber: "",
      reraNote: "",
      amenities: [],
      parkingCovered: 1,
      parkingOpen: 0,
      maintenancePerMonth: 0,
      ownership: "Freehold",
      overlooking: [],
      flooring: "",
      waterSupply: "",
      powerBackup: "",
      gatedCommunity: false,
      approvedBanks: [],
      nearby: [],
      images: [],
    };
  }
  const isPlot = p.type === "Plot";
  return {
    title: p.title,
    type: p.type,
    bhk: p.bhk,
    bathrooms: p.bathrooms,
    balconies: p.balconies,
    projectName: p.projectName,
    developer: p.developer,
    description: p.description,
    highlights: p.highlights,
    featured: p.featured,
    published: p.published,
    city: p.location.city,
    locality: p.location.locality,
    area: p.location.area,
    address: p.location.address,
    pincode: p.location.pincode,
    price: p.price,
    carpetArea: isPlot ? undefined : p.carpetArea,
    builtUpArea: isPlot ? undefined : p.builtUpArea,
    superBuiltUpArea: isPlot ? undefined : p.superBuiltUpArea,
    plotArea: p.plotArea,
    floor: p.floor,
    totalFloors: p.totalFloors,
    facing: (FACINGS as readonly string[]).includes(p.facing) ? (p.facing as (typeof FACINGS)[number]) : "East",
    furnishing: p.furnishing,
    status: p.status,
    possession: p.possession,
    ageYears: p.ageYears,
    reraApplicable: p.rera.applicable,
    reraNumber: p.rera.number ?? "",
    reraNote: p.rera.note ?? "",
    amenities: p.amenities,
    parkingCovered: p.parking.covered,
    parkingOpen: p.parking.open,
    maintenancePerMonth: p.maintenancePerMonth,
    ownership: p.ownership,
    overlooking: p.overlooking,
    flooring: p.flooring === "—" ? "" : p.flooring,
    waterSupply: p.waterSupply === "—" ? "" : p.waterSupply,
    powerBackup: p.powerBackup === "—" ? "" : p.powerBackup,
    gatedCommunity: p.gatedCommunity,
    approvedBanks: p.approvedBanks,
    nearby: p.nearby,
    images: p.images,
  };
}

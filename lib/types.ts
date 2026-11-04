export type PropertyType = "Apartment" | "Villa" | "Independent House" | "Row House" | "Penthouse" | "Plot";
export type Furnishing = "Unfurnished" | "Semi-Furnished" | "Fully Furnished";
export type Status = "Ready to Move" | "Under Construction";

export const PROPERTY_TYPES: PropertyType[] = ["Apartment", "Villa", "Independent House", "Row House", "Penthouse", "Plot"];
export const FURNISHINGS: Furnishing[] = ["Unfurnished", "Semi-Furnished", "Fully Furnished"];

export interface NearbyPlace {
  kind: string;
  name: string;
  distanceKm: number;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  projectName: string;
  developer: string;
  type: PropertyType;
  /** 0 for plots */
  bhk: number;
  bathrooms: number;
  balconies: number;
  /** INR */
  price: number;
  carpetArea: number;
  builtUpArea: number;
  superBuiltUpArea: number;
  plotArea?: number;
  location: {
    city: string; // slug
    cityName: string;
    locality: string; // slug
    localityName: string;
    area: string; // slug
    areaName: string;
    address: string;
    pincode: string;
    lat: number;
    lng: number;
  };
  floor?: number;
  totalFloors?: number;
  facing: string;
  furnishing: Furnishing;
  status: Status;
  possession: string; // e.g. "Immediate" or "Dec 2027"
  ageYears?: number;
  rera: {
    applicable: boolean;
    number?: string;
    authority: string;
    website: string;
    note?: string;
  };
  amenities: string[];
  parking: { covered: number; open: number };
  maintenancePerMonth: number;
  ownership: "Freehold" | "Leasehold" | "Co-operative Society";
  overlooking: string[];
  flooring: string;
  waterSupply: string;
  powerBackup: string;
  gatedCommunity: boolean;
  nearby: NearbyPlace[];
  approvedBanks: string[];
  description: string;
  highlights: string[];
  images: string[];
  postedOn: string; // ISO date
  featured: boolean;
  /** Visual seed for generated illustrations */
  hue: number;
  /** Demo inventory: shown with a "Sample listing" tag and never linked to official registries. */
  isSample: boolean;
  /** Visible on the public site. Drafts are only visible in Studio. */
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Increments on every save; used to reject saves from stale forms. */
  rev?: number;
}

/** Light shape sent to client components & cards. */
export interface PropertySummary {
  id: string;
  slug: string;
  title: string;
  projectName: string;
  type: PropertyType;
  bhk: number;
  price: number;
  superBuiltUpArea: number;
  carpetArea: number;
  cityName: string;
  localityName: string;
  areaName: string;
  status: Status;
  furnishing: Furnishing;
  reraApplicable: boolean;
  amenities: string[];
  featured: boolean;
  hue: number;
  postedOn: string;
  images: string[];
  isSample: boolean;
  developer: string;
  floor?: number;
  totalFloors?: number;
  possession: string;
  plotArea?: number;
}

export function toSummary(p: Property): PropertySummary {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    projectName: p.projectName,
    type: p.type,
    bhk: p.bhk,
    price: p.price,
    superBuiltUpArea: p.superBuiltUpArea,
    carpetArea: p.carpetArea,
    cityName: p.location.cityName,
    localityName: p.location.localityName,
    areaName: p.location.areaName,
    status: p.status,
    furnishing: p.furnishing,
    reraApplicable: p.rera.applicable,
    amenities: p.amenities.slice(0, 4),
    featured: p.featured,
    hue: p.hue,
    postedOn: p.postedOn,
    images: p.images.slice(0, 1), // cards only show the cover photo
    isSample: !!p.isSample,
    developer: p.developer,
    floor: p.floor,
    totalFloors: p.totalFloors,
    possession: p.possession,
    plotArea: p.type === "Plot" ? p.plotArea ?? p.superBuiltUpArea : undefined,
  };
}

export const AMENITY_GROUPS: Record<string, string[]> = {
  Lifestyle: ["Clubhouse", "Swimming Pool", "Gymnasium", "Landscaped Garden", "Party Hall", "Rooftop Terrace", "Jogging Track", "Yoga Deck"],
  "Sports & Kids": ["Tennis Court", "Badminton Court", "Indoor Games Room", "Children's Play Area", "Cricket Practice Net"],
  "Safety & Security": ["24x7 Security", "CCTV Surveillance", "Gated Community", "Fire Safety Systems", "Video Intercom"],
  Convenience: ["Power Backup", "Lift", "Visitor Parking", "Rainwater Harvesting", "Sewage Treatment Plant", "EV Charging", "Piped Gas", "Convenience Store"],
  "Private Features": ["Private Garden", "Private Pool", "Servant Quarters", "Study Room", "Puja Room", "Sea View Deck"],
};

export const ALL_AMENITIES = Object.values(AMENITY_GROUPS).flat();

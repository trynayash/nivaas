// Deterministic SAMPLE inventory generator. All projects, developers and RERA numbers are fictional
// and exist only to demonstrate search & recommendations. Replace with real data via data/properties.json.
import { CITIES, CityNode, LocalityNode, slugify } from "./locations";
import { AMENITY_GROUPS, Furnishing, Property, PropertyType } from "./types";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Re-created on every generateProperties() call so the output is identical each time.
const SEED = 20261104;
let rnd = mulberry32(SEED);
const between = (a: number, b: number) => a + rnd() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const pickN = <T,>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
};
const weighted = <T,>(pairs: [T, number][]): T => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
};

const DEVELOPERS: Record<string, string[]> = {
  bangalore: ["Banyan Grove Builders", "Meridian Spaces", "Kaveri Constructions", "Northstar Habitat", "Aranya Developers"],
  "murud-janjira": ["Konkan Coast Realty", "Sagar Kinara Homes", "Janjira Estates", "Owner (resale)"],
  pune: ["Sahyadri Homes", "Deccan Crest Developers", "Tulsi Infra", "Pashan Ridge Realty"],
  mumbai: ["Arabian Bay Developers", "Tulsi Infra", "Skyline Crest Realty", "Meridian Spaces"],
};

const PROJECT_A = ["Aranya", "Sapphire", "Banyan", "Kaveri", "Tulsi", "Coral", "Amaltas", "Neelgiri", "Saffron", "Mayur", "Indigo", "Vanam", "Shanti", "Ivory", "Sagar"];
const PROJECT_B: Record<PropertyType, string[]> = {
  Apartment: ["Heights", "Residency", "Greens", "Towers", "Enclave", "Courtyard", "Vista"],
  Penthouse: ["Sky Residences", "Crest", "Pinnacle"],
  Villa: ["Villas", "Estate", "Grove", "Retreat"],
  "Row House": ["Row Homes", "Terraces", "Lane Homes"],
  "Independent House": ["House", "Bungalow", "Niwas"],
  Plot: ["Plots", "Layout", "Farmlands"],
};

const NEARBY: Record<string, [kind: string, name: string, min: number, max: number][]> = {
  bangalore: [
    ["Metro", "Nearest Namma Metro station", 0.6, 4.5],
    ["School", "CBSE / ICSE school", 0.4, 2.5],
    ["Hospital", "Multi-speciality hospital", 0.8, 4],
    ["Work", "IT park / business district", 1, 9],
    ["Shopping", "Shopping mall", 1, 6],
    ["Airport", "Kempegowda International Airport", 18, 48],
  ],
  "murud-janjira": [
    ["Beach", "Murud beach", 0.2, 4],
    ["Landmark", "Janjira Fort jetty (Rajpuri)", 0.5, 9],
    ["Hospital", "Rural hospital, Murud", 0.5, 6],
    ["Market", "Murud market & bus stand", 0.3, 5],
    ["Travel", "Alibaug", 48, 56],
    ["Travel", "Mumbai (by road)", 150, 165],
  ],
  pune: [
    ["Metro", "Pune Metro station", 0.8, 6],
    ["School", "CBSE school", 0.4, 2.5],
    ["Hospital", "Multi-speciality hospital", 0.8, 4],
    ["Work", "IT park", 1, 8],
    ["Shopping", "Shopping mall", 1, 5],
    ["Airport", "Pune International Airport", 4, 24],
  ],
  mumbai: [
    ["Metro", "Metro / suburban railway station", 0.4, 2.5],
    ["School", "ICSE / IB school", 0.3, 2],
    ["Hospital", "Multi-speciality hospital", 0.5, 3],
    ["Work", "Business district", 1, 10],
    ["Shopping", "Shopping mall", 0.6, 4],
    ["Airport", "Chhatrapati Shivaji Maharaj International Airport", 3, 22],
  ],
};

const PINCODES: Record<string, number> = { bangalore: 560066, "murud-janjira": 402401, pune: 411014, mumbai: 400076 };
const BANKS = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "LIC Housing Finance", "Bank of Baroda", "Kotak Mahindra Bank"];
const FACINGS = ["East", "North-East", "North", "West", "South-East", "North-West"];
const HUES = [18, 28, 145, 160, 200, 210, 34, 12, 175, 190];

function typeFor(city: string, loc: LocalityNode): PropertyType {
  if (city === "murud-janjira")
    return weighted<PropertyType>([["Villa", 30], ["Independent House", 25], ["Apartment", 25], ["Row House", 10], ["Plot", 10]]);
  const villaFriendly = ["whitefield", "sarjapur-road", "yelahanka", "hinjewadi", "wakad"].includes(loc.slug);
  const houseFriendly = ["hsr-layout", "koramangala", "indiranagar", "pali-hill", "bandra-west"].includes(loc.slug);
  return weighted<PropertyType>([
    ["Apartment", 74],
    ["Villa", villaFriendly ? 14 : 0],
    ["Independent House", houseFriendly ? 14 : 2],
    ["Penthouse", 5],
    ["Row House", villaFriendly ? 5 : 0],
  ]);
}

function bhkFor(type: PropertyType): number {
  if (type === "Plot") return 0;
  if (type === "Villa" || type === "Independent House") return weighted([[3, 40], [4, 40], [5, 20]]);
  if (type === "Penthouse") return weighted([[3, 30], [4, 50], [5, 20]]);
  if (type === "Row House") return weighted([[2, 20], [3, 60], [4, 20]]);
  return weighted([[1, 8], [2, 36], [3, 38], [4, 15], [5, 3]]);
}

const SIZE: Record<number, [number, number]> = { 1: [600, 760], 2: [1050, 1320], 3: [1450, 1950], 4: [2300, 3200], 5: [3500, 4800] };
const TYPE_PRICE_FACTOR: Record<PropertyType, number> = {
  Apartment: 1,
  Penthouse: 1.3,
  Villa: 1.15,
  "Independent House": 1.2,
  "Row House": 1.05,
  Plot: 0.45,
};

function roundPrice(p: number) {
  if (p < 10_000_000) return Math.round(p / 100_000) * 100_000; // nearest lakh
  return Math.round(p / 500_000) * 500_000; // nearest 5 lakh
}

let serial = 0;

function makeProperty(city: CityNode, loc: LocalityNode, overrides: Partial<{ type: PropertyType; bhk: number }> = {}): Property {
  serial++;
  const id = `NV${String(1000 + serial)}`;
  const type = overrides.type ?? typeFor(city.slug, loc);
  const bhk = overrides.bhk ?? bhkFor(type);
  const area = pick(loc.areas);
  const mumbaiFactor = city.slug === "mumbai" ? 0.72 : 1;

  let superBuiltUp: number;
  let plotArea: number | undefined;
  if (type === "Plot") {
    plotArea = Math.round(int(1500, 5400) / 50) * 50;
    superBuiltUp = plotArea;
  } else {
    const [a, b] = SIZE[bhk];
    const villaBoost = type === "Villa" || type === "Independent House" ? 1.25 : 1;
    superBuiltUp = Math.round((between(a, b) * villaBoost * mumbaiFactor) / 5) * 5;
    if (type === "Villa" || type === "Independent House" || type === "Row House") {
      plotArea = Math.round((superBuiltUp * between(0.75, 1.4)) / 50) * 50;
    }
  }
  const builtUp = type === "Plot" ? superBuiltUp : Math.round(superBuiltUp * 0.86);
  const carpet = type === "Plot" ? superBuiltUp : Math.round(superBuiltUp * between(0.68, 0.76));
  const price = roundPrice(superBuiltUp * loc.ppsf * TYPE_PRICE_FACTOR[type] * between(0.88, 1.12));

  const isTower = type === "Apartment" || type === "Penthouse";
  const totalFloors = isTower ? (city.slug === "murud-janjira" ? int(3, 5) : int(8, 32)) : type === "Plot" ? undefined : int(2, 3);
  const floor = isTower ? (type === "Penthouse" ? totalFloors : int(1, totalFloors! - 1)) : undefined;

  const ready = type === "Plot" ? true : rnd() < 0.6;
  const ageYears = ready && type !== "Plot" ? int(0, 13) : undefined;
  const possession = ready ? "Immediate" : `${pick(["Mar", "Jun", "Sep", "Dec"])} ${int(2027, 2029)}`;

  let rera: Property["rera"];
  const reraApplicable = !ready || (ageYears !== undefined && ageYears <= 8) || (type === "Plot" && rnd() < 0.5);
  if (reraApplicable) {
    const n = String(serial * 37 + 1200).padStart(6, "0");
    const number =
      city.slug === "bangalore"
        ? `PRM/KA/RERA/1251/${300 + (serial % 40)}/PR/${int(19, 25)}${String(int(1, 12)).padStart(2, "0")}${String(int(1, 28)).padStart(2, "0")}/${n}`
        : `P5${city.slug === "mumbai" ? "1800" : city.slug === "pune" ? "2100" : "2000"}${n}`;
    rera = { applicable: true, number, authority: city.rera.authority, website: city.rera.website };
  } else {
    rera = {
      applicable: false,
      authority: city.rera.authority,
      website: city.rera.website,
      note:
        type === "Plot"
          ? "Individual resale plot – RERA registration not applicable. Verify 7/12 extract and NA order."
          : "Completed before RERA registration was mandatory. Verify Occupancy Certificate (OC) and title documents.",
    };
  }

  // Amenities
  const g = AMENITY_GROUPS;
  let amenities: string[];
  if (isTower || type === "Row House") {
    amenities = [
      ...pickN(g["Lifestyle"], int(3, 7)),
      ...pickN(g["Sports & Kids"], int(1, 3)),
      ...pickN(g["Safety & Security"], int(3, 5)),
      ...pickN(g["Convenience"], int(4, 7)),
    ];
    if (isTower && !amenities.includes("Lift")) amenities.push("Lift");
  } else if (type === "Plot") {
    amenities = pickN(["Gated Community", "24x7 Security", "Rainwater Harvesting", "Landscaped Garden", "Power Backup"], int(1, 3));
  } else {
    amenities = [
      "Private Garden",
      ...pickN(["Private Pool", "Servant Quarters", "Study Room", "Puja Room"], int(1, 3)),
      ...pickN(["Power Backup", "Rainwater Harvesting", "24x7 Security", "CCTV Surveillance", "Gated Community", "Clubhouse", "EV Charging"], int(2, 5)),
    ];
  }
  const coastal = city.slug === "murud-janjira" && ["madhli-aai", "nandgaon", "kashid", "rajpuri"].includes(loc.slug);
  if (coastal && type !== "Plot" && rnd() < 0.55) amenities.push("Sea View Deck");
  amenities = [...new Set(amenities)];

  const furnishing: Furnishing = type === "Plot" ? "Unfurnished" : weighted<Furnishing>([["Unfurnished", 40], ["Semi-Furnished", 42], ["Fully Furnished", 18]]);
  const overlookingPool = ["Garden / Park", "Main Road", "Clubhouse", "Pool"];
  if (coastal) overlookingPool.push("Sea", "Sea", "Coconut grove");
  if (["kaikondrahalli", "hiranandani-gardens", "kempapura"].includes(area.slug)) overlookingPool.push("Lake", "Lake");
  const overlooking = pickN(overlookingPool, int(1, 2));

  const devs = DEVELOPERS[city.slug];
  const developer = type === "Independent House" && rnd() < 0.5 ? "Owner (resale)" : pick(devs);
  const projectName =
    developer === "Owner (resale)" ? `${pick(PROJECT_A)} ${pick(PROJECT_B[type])}` : `${developer.split(" ")[0]} ${pick(PROJECT_B[type])}`;

  const nearby = NEARBY[city.slug].map(([kind, name, min, max]) => ({ kind, name, distanceKm: +between(min, max).toFixed(1) }));
  const approvedBanks = pickN(BANKS, int(3, 6));

  const typeLabel = type === "Plot" ? "Residential Plot" : `${bhk} BHK ${type}`;
  const title = `${typeLabel} in ${area.name}, ${loc.name}`;

  const highlightPool = [
    ready ? "Ready to move in" : `Possession by ${possession}`,
    rera.applicable ? "RERA registered project" : "Clear title, resale",
    `${overlooking[0]} facing views`,
    `${nearby[0].distanceKm} km to ${nearby[0].name.toLowerCase()}`,
    furnishing === "Fully Furnished" ? "Move-in ready with modular kitchen & wardrobes" : "Spacious layout with good ventilation",
    type === "Villa" ? "Private garden and independent entrance" : "Low-density community",
  ];
  const highlights = pickN(highlightPool, 4);

  const description =
    type === "Plot"
      ? `A ${plotArea?.toLocaleString("en-IN")} sq.ft residential plot in ${area.name}, ${loc.name}. Level land with road access on one side, ideal for building a weekend home. Located ${nearby[0].distanceKm} km from ${nearby[0].name.toLowerCase()}.`
      : `${title} is a ${ready ? "ready-to-move" : "new under-construction"} home in ${projectName} by ${developer}. ` +
        `It offers ${carpet.toLocaleString("en-IN")} sq.ft of carpet area across ${bhk} bedrooms and ${Math.max(1, bhk)} bathrooms, ` +
        `${floor !== undefined ? `on floor ${floor} of ${totalFloors}, ` : ""}${furnishing.toLowerCase()} and ${FACINGS[serial % FACINGS.length].toLowerCase()}-facing. ` +
        `The home overlooks ${overlooking.join(" and ").toLowerCase()} and is ${nearby[1].distanceKm} km from the nearest ${nearby[1].kind.toLowerCase()}.`;

  const posted = new Date(Date.UTC(2026, 10, 1) - int(0, 95) * 86400000);

  return {
    id,
    slug: slugify(`${typeLabel} ${area.name} ${loc.name} ${id}`),
    title,
    projectName,
    developer,
    type,
    bhk,
    bathrooms: type === "Plot" ? 0 : Math.max(1, bhk - (rnd() < 0.3 ? 1 : 0)) + (bhk >= 4 && rnd() < 0.5 ? 1 : 0),
    balconies: type === "Plot" ? 0 : int(1, Math.max(1, bhk)),
    price,
    carpetArea: carpet,
    builtUpArea: builtUp,
    superBuiltUpArea: superBuiltUp,
    plotArea,
    location: {
      city: city.slug,
      cityName: city.name,
      locality: loc.slug,
      localityName: loc.name,
      area: area.slug,
      areaName: area.name,
      address: `${projectName}, ${area.name}, ${loc.name}, ${city.name}, ${city.state}`,
      pincode: String(PINCODES[city.slug] + (serial % 9)),
      lat: area.lat,
      lng: area.lng,
    },
    floor,
    totalFloors,
    facing: FACINGS[serial % FACINGS.length],
    furnishing,
    status: ready ? "Ready to Move" : "Under Construction",
    possession,
    ageYears,
    rera,
    amenities,
    parking: type === "Plot" ? { covered: 0, open: 0 } : { covered: bhk >= 3 ? 2 : 1, open: type === "Villa" ? 2 : rnd() < 0.3 ? 1 : 0 },
    maintenancePerMonth: type === "Plot" ? 0 : Math.round((superBuiltUp * between(2.5, 6)) / 100) * 100,
    ownership: city.slug === "mumbai" && ready && (ageYears ?? 0) > 6 ? "Co-operative Society" : "Freehold",
    overlooking,
    flooring: type === "Plot" ? "—" : pick(["Vitrified tiles", "Italian marble", "Wooden (bedrooms) + vitrified", "Granite"]),
    waterSupply: type === "Plot" ? "Borewell permitted" : pick(["24 hrs · Municipal + borewell", "24 hrs · Municipal", "Borewell + tanker backup"]),
    powerBackup: type === "Plot" ? "—" : isTower ? pick(["Full backup", "Partial (lifts & common areas)"]) : pick(["Inverter", "DG backup"]),
    gatedCommunity: amenities.includes("Gated Community") || isTower,
    nearby,
    approvedBanks,
    description,
    highlights,
    images: [],
    postedOn: posted.toISOString().slice(0, 10),
    featured: false,
    hue: pick(HUES),
    isSample: true,
    published: true,
  };
}

export function generateProperties(): Property[] {
  serial = 0;
  rnd = mulberry32(SEED);
  const out: Property[] = [];
  const perLocality: Record<string, number> = { bangalore: 9, "murud-janjira": 5, pune: 6, mumbai: 6 };
  for (const c of CITIES) {
    for (const l of c.localities) {
      // Guarantee examples discussed in the requirements exist.
      if (l.slug === "madhli-aai") {
        out.push(makeProperty(c, l, { type: "Villa", bhk: 3 }));
        out.push(makeProperty(c, l, { type: "Independent House", bhk: 3 }));
        out.push(makeProperty(c, l, { type: "Apartment", bhk: 3 }));
        out.push(makeProperty(c, l, { type: "Apartment", bhk: 2 }));
      }
      if (c.slug === "bangalore") {
        out.push(makeProperty(c, l, { type: "Apartment", bhk: 2 }));
        out.push(makeProperty(c, l, { type: "Apartment", bhk: 3 }));
      }
      for (let i = 0; i < perLocality[c.slug]; i++) out.push(makeProperty(c, l));
    }
  }
  // Mark a spread of featured listings.
  out.forEach((p, i) => {
    if (i % 11 === 3) p.featured = true;
  });
  return out;
}

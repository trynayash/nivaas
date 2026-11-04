// Location hierarchy: City (main location) → Locality (sub-location) → Area (specific area).
// Coordinates are approximate and only used to compute "nearby" distances.

export interface AreaNode {
  name: string;
  slug: string;
  lat: number;
  lng: number;
}

export interface LocalityNode {
  name: string;
  slug: string;
  aliases?: string[];
  lat: number;
  lng: number;
  /** Typical price per sq.ft (INR) used by the sample data generator. */
  ppsf: number;
  areas: AreaNode[];
}

export interface CityNode {
  name: string;
  slug: string;
  state: string;
  aliases: string[];
  rera: { authority: string; website: string };
  localities: LocalityNode[];
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type RawLocality = [name: string, lat: number, lng: number, ppsf: number, areas: string[], aliases?: string[]];

function city(
  name: string,
  state: string,
  aliases: string[],
  rera: CityNode["rera"],
  locs: RawLocality[]
): CityNode {
  return {
    name,
    slug: slugify(name),
    state,
    aliases,
    rera,
    localities: locs.map(([lname, lat, lng, ppsf, areas, laliases]) => ({
      name: lname,
      slug: slugify(lname),
      aliases: laliases,
      lat,
      lng,
      ppsf,
      areas: areas.map((a, i) => {
        // Spread areas around the locality centre.
        const angle = (i / Math.max(1, areas.length)) * Math.PI * 2;
        const r = 0.006 + (i % 2) * 0.004;
        return {
          name: a,
          slug: slugify(a),
          lat: +(lat + Math.sin(angle) * r).toFixed(5),
          lng: +(lng + Math.cos(angle) * r).toFixed(5),
        };
      }),
    })),
  };
}

const KRERA = { authority: "Karnataka RERA (K-RERA)", website: "https://rera.karnataka.gov.in" };
const MAHARERA = { authority: "MahaRERA", website: "https://maharera.maharashtra.gov.in" };

export const CITIES: CityNode[] = [
  city("Bangalore", "Karnataka", ["bengaluru", "blr", "banglore", "bangaluru"], KRERA, [
    ["Whitefield", 12.9698, 77.75, 8600, ["Hope Farm", "ITPL Main Road", "Varthur Road", "Kadugodi"]],
    ["Sarjapur Road", 12.9105, 77.6865, 8200, ["Kaikondrahalli", "Dommasandra", "Carmelaram"], ["sarjapur"]],
    ["HSR Layout", 12.9116, 77.6389, 12500, ["Sector 1", "Sector 2", "Sector 7"], ["hsr"]],
    ["Koramangala", 12.9352, 77.6245, 16500, ["5th Block", "6th Block", "8th Block"]],
    ["Hebbal", 13.0358, 77.597, 11000, ["Kempapura", "Manyata Tech Park Road", "Sahakar Nagar"]],
    ["Electronic City", 12.8452, 77.6602, 6200, ["Phase 1", "Phase 2", "Neeladri Nagar"], ["e city", "ecity"]],
    ["Indiranagar", 12.9719, 77.6412, 18500, ["HAL 2nd Stage", "Defence Colony", "100 Feet Road"]],
    ["Yelahanka", 13.1005, 77.5963, 7400, ["Yelahanka New Town", "Jakkur", "Allalasandra"]],
  ]),
  city("Murud Janjira", "Maharashtra", ["murud", "murud-janjira", "janjira"], MAHARERA, [
    ["Madhli Aai", 18.3312, 72.9612, 5200, ["Beach Road", "Temple Lane", "Koliwada"], ["madhli ali", "madhli"]],
    ["Rajpuri", 18.2985, 72.9558, 4600, ["Jetty Road", "Khokari Road"]],
    ["Ekdara", 18.3171, 72.9504, 4300, ["Ekdara Creek", "Darya Nagar"]],
    ["Nandgaon", 18.3802, 72.9311, 4900, ["Nandgaon Beach", "Ganpati Mandir Road"]],
    ["Kashid", 18.4335, 72.9022, 6400, ["Kashid Beach Road", "Hill View"]],
  ]),
  city("Pune", "Maharashtra", ["poona"], MAHARERA, [
    ["Kharadi", 18.5515, 73.9348, 10200, ["EON IT Park", "Kharadi Bypass", "Thite Nagar"]],
    ["Baner", 18.559, 73.7868, 11800, ["Baner Road", "Balewadi Phata", "Pancard Club Road"]],
    ["Hinjewadi", 18.5912, 73.7389, 7600, ["Phase 1", "Phase 2", "Maan Road"]],
    ["Wakad", 18.5975, 73.77, 8400, ["Datta Mandir Road", "Bhumkar Chowk"]],
    ["Viman Nagar", 18.5679, 73.9143, 12800, ["Symbiosis Road", "Datta Mandir Chowk"]],
  ]),
  city("Mumbai", "Maharashtra", ["bombay"], MAHARERA, [
    ["Powai", 19.1176, 72.906, 24500, ["Hiranandani Gardens", "Chandivali", "IIT Market"]],
    ["Andheri West", 19.1364, 72.8296, 27000, ["Lokhandwala", "Four Bungalows", "DN Nagar"], ["andheri"]],
    ["Bandra West", 19.0596, 72.8295, 52000, ["Pali Hill", "Carter Road", "Hill Road"], ["bandra"]],
    ["Thane West", 19.2183, 72.9781, 14500, ["Ghodbunder Road", "Majiwada", "Hiranandani Estate"], ["thane"]],
    ["Goregaon East", 19.1663, 72.8526, 21000, ["Film City Road", "Aarey Road"], ["goregaon"]],
  ]),
];

export interface FlatLocation {
  level: "city" | "locality" | "area";
  name: string;
  /** Human label, e.g. "Hope Farm, Whitefield, Bangalore" */
  label: string;
  city: string; // city slug
  locality?: string; // locality slug
  area?: string; // area slug
  /** Normalised search terms for this node. */
  terms: string[];
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every node of the hierarchy, flattened (useful for search parsing & autocomplete). */
export const FLAT_LOCATIONS: FlatLocation[] = CITIES.flatMap((c) => [
  {
    level: "city" as const,
    name: c.name,
    label: c.name,
    city: c.slug,
    terms: [norm(c.name), ...c.aliases.map(norm)],
  },
  ...c.localities.flatMap((l) => [
    {
      level: "locality" as const,
      name: l.name,
      label: `${l.name}, ${c.name}`,
      city: c.slug,
      locality: l.slug,
      terms: [norm(l.name), ...(l.aliases ?? []).map(norm)],
    },
    ...l.areas.map((a) => ({
      level: "area" as const,
      name: a.name,
      label: `${a.name}, ${l.name}, ${c.name}`,
      city: c.slug,
      locality: l.slug,
      area: a.slug,
      terms: [norm(a.name)],
    })),
  ]),
]);

export function getCity(slug?: string) {
  return CITIES.find((c) => c.slug === slug);
}

export function getLocality(citySlug: string | undefined, locSlug: string) {
  return getCity(citySlug)?.localities.find((l) => l.slug === locSlug);
}

export function findLocalityAnywhere(locSlug: string) {
  for (const c of CITIES) {
    const l = c.localities.find((x) => x.slug === locSlug);
    if (l) return { city: c, locality: l };
  }
  return undefined;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

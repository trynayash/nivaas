# Nivaas — real estate site with a custom CMS, smart search & similar-property recommendations

A working prototype of the scope from the requirements call. It has three layers:

| Layer | What it does | Where |
|---|---|---|
| **1. Website management (CMS)** | Visual, no-code editor for the landing page: content **and** styling | `/admin` |
| **2. Property discovery** | Natural-language search + left-side filters over a city → locality → area hierarchy | `/search` |
| **3. Property intelligence** | "Similar properties you may like" on every property page, plus close matches on search results | `/property/[slug]` |

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Studio (CMS) is at `/admin`. The development password is `admin`. **Set `ADMIN_PASSWORD` (and `SESSION_SECRET`) before deploying.**

```bash
ADMIN_PASSWORD='something-long' SESSION_SECRET='random-32+-chars' npm run build && npm start
```

## Requirements → implementation

### A. Custom CMS, WordPress-like flexibility, not WordPress's look
- **Visual editor:** a three-panel Studio. On the left is the section list (drag or ↑↓ to reorder, hide, add from a library). In the middle is the live canvas, which uses the same renderer as the public site. On the right is the inspector.
- **Content:** click any text on the page and type, or edit it in the inspector. List items (stats, features, cities, nav links, quick searches) can be added, removed and reordered.
- **Typography for every text element:** change the element (H1–H6, P, inline), font size, weight, **bold**, *italic*, underline, **overline**, strikethrough, colour, alignment override, line height, letter spacing, case and typeface (display/body).
- **Section styling:** background (none / colour / gradient / image with a darkening overlay), text colour, alignment (left/centre/right), content width, vertical spacing and corner radius.
- **Site style:** theme colours, presets, display/body fonts and global radius.
- **Workflow:** autosaving draft, **Preview** of the draft (`/?preview=draft`) and **Publish**. The last 15 published versions can be restored. Undo/redo (Ctrl+Z / Ctrl+Shift+Z), Ctrl+B/I/U, Ctrl+S.
- **Device preview:** desktop / tablet / mobile. Layouts use CSS container queries, so the preview matches real devices.
- The header and footer edited in the CMS also wrap the search and property pages.

### B. Property search
- Free-text queries such as `property in Bangalore`, `2BHK in Bangalore`, `4BHK in Whitefield Bangalore`, `3BHK in Madhli Aai, Murud Janjira`, `villas in Murud under 2 Cr`, `2,3 bhk in HSR 80 lakh to 1.5 cr`, `ready to move flats in Powai`, and Hinglish like `Bangalore mein 2BHK chahiye`.
- The parser (`lib/search.ts`) understands BHK, budget (lakh/crore, under/above/range), property type, possession, furnishing and **location at any level** (city, locality, area, with aliases such as Bengaluru and Murud). It also handles typos (`banglore whitefeild`).
- The search bar autocompletes locations and shows a live "Searching for …" read-back of what it understood.

### C. Search results page
- **Left filter panel:** location hierarchy (city → locality checkboxes → area checkboxes, with counts), configuration, **budget (never pre-applied)**, property type, possession, furnishing, size and amenities.
- Removable active-filter chips, sorting and pagination.
- **"Matching properties"** below the results: homes that miss by one or two criteria (nearby locality with distance, ±1 BHK, up to 20% over budget). Each one is labelled with the reason.

### D. Property detail page
Configuration, property type, carpet / built-up / super built-up / plot area, bathrooms, balconies, floor, facing, furnishing, status, possession, age, parking and ownership. It also has a **RERA panel** (number, authority, link to the official portal, or a "not applicable" explanation), overview and highlights, grouped amenities, and specifications (project, developer, overlooking, flooring, water, power backup, gated, maintenance). The page shows the location path and nearby places, an indicative floor plan, price per sq.ft compared with the locality average, an EMI calculator and approved banks.

### E. Similar-property recommendations (`lib/recommend.ts`)
Every other listing in the same city is scored out of 100:

| Signal | Weight |
|---|---|
| Location (same area > same locality > distance) | 30 |
| Configuration (same BHK, ±1 partial) | 25 |
| Price similarity (within ±35%) | 22 |
| Property type | 8 |
| Size | 8 |
| Amenity overlap | 7 |

If the visitor came from a search, the search context goes with them to the detail page. Homes that also match that search are boosted and labelled "Matches your search", and homes over budget are pushed down. Each card shows its match % and the reasons.

## Project layout

```
app/                    routes (landing, search, property, admin, API)
components/cms/         PageRenderer — one renderer for the public site and the editor canvas
components/admin/       Studio editor, inspector, controls
components/search/      Filters panel
lib/cms/schema.ts       CMS content model, section registry, defaults
lib/cms/store.ts        draft / published / version history (JSON file)
lib/locations.ts        city → locality → area hierarchy (+ coordinates)
lib/search.ts           query parser, filters, facets, close matches
lib/recommend.ts        similarity scoring
lib/seed.ts             deterministic SAMPLE inventory (fictional)
```

## Important notes before production

- **Sample data:** all listings, projects, developers and RERA numbers are **fictional**, generated by `lib/seed.ts`. To use real inventory, put it in `data/properties.json` (same `Property` shape) or replace `lib/properties.ts` with a database query.
- **Storage:** the CMS is saved to `data/cms.json`. That works on a VPS but **not on serverless hosts** (Vercel etc. have ephemeral file systems). Swap `lib/cms/store.ts` for a database table (Postgres/Supabase) when deploying.
- **Images:** listings support an `images` array. Without photos, a generated illustration is shown. Section backgrounds take an image URL. Uploads need a storage bucket.
- **Auth:** there is a single admin password with an HMAC-signed cookie. Roles and permissions were not specified.

## Not yet specified (needs product decisions)
Admin roles, a property submission/approval workflow and property management UI, image/video gallery management, a map, enquiries/lead capture, CRM integration, and user accounts.

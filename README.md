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
cp .env.example .env.local   # then set ADMIN_PASSWORD
npm run dev                  # http://localhost:3000 — Studio at /admin
```

| Variable | Required | What it does |
|---|---|---|
| `ADMIN_PASSWORD` | **Yes** | Studio password, at least 12 characters. Read from the environment only — there is no default. In production the server **refuses to start** without it; in development the Studio login is disabled until it is set. |
| `SESSION_SECRET` | No | Key that signs the admin cookie. If unset, a random key is generated once and kept in the database (`app_meta`), so sessions survive restarts and are shared by all server instances. It is never derived from the password. |
| `DATABASE_URL` | On Vercel, yes | Postgres for CMS content (draft, published page, last 15 versions). Unset → `data/cms.json` (local only). On Vercel without it, saving fails with a clear error. |
| `PG_POOL_MAX` | No | Connections per server instance (default 3). |
| `CONTACT_WHATSAPP` | No | WhatsApp number for “#contact” buttons and the property page, e.g. `919561713120`. |
| `BLOB_READ_WRITE_TOKEN` | On Vercel, for photos | Set automatically when a Vercel Blob store is connected. Locally, photos go to `data/uploads`. |
| `SEED_SAMPLE_LISTINGS` | No | `false` = start a new database without the 177 sample listings. |
| `ALLOW_INDEXING` / `SITE_URL` | No | Search engines are blocked until `ALLOW_INDEXING=true`. `SITE_URL` is the public address used for canonical links, link previews and the sitemap; on Vercel it defaults to the production domain. |

### CMS storage

`lib/cms/store.ts` picks an adapter that implements `CmsStorage` (`lib/cms/storage/types.ts`):

- **Postgres** (`lib/cms/storage/postgres.ts`) when `DATABASE_URL` is set. Tables (`cms_pages`, `cms_page_versions`) are created automatically on first request; publishing archives the old version in a transaction with a row lock and keeps the newest 15. If the tables are dropped while running, they are recreated on the next request.
- **JSON file** (`lib/cms/storage/json-file.ts`) otherwise.

```bash
DATABASE_URL=postgres://… npm run db:migrate   # create tables; imports data/cms.json if present
```

On Vercel use a pooled connection string (Neon, Supabase pooler) with `?sslmode=require`.

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

## Studio (Phase 3)

Studio (`/admin`) has three sections, linked from the top bar:

- **Landing page** — the visual editor described above.
- **Listings** — every property, with search and filters (city, live/draft, own/sample). Add or edit a listing with a form that checks everything before saving (location must exist in the city → locality → area list, carpet ≤ super built-up, RERA number or a reason it doesn’t apply, …). Upload up to 20 photos (resized in the browser, first one is the cover), save as a draft, preview it, publish, unpublish or delete. **Remove sample listings** deletes all demo data in one click; it never comes back.
- **Enquiries** — “Request a call back” submissions from property pages, newest first, with status (new / contacted / closed), private notes, one-click WhatsApp or call, and a CSV download. The badge in the top bar counts new enquiries.

The public enquiry form has a hidden honeypot field, ignores instant (bot) submissions, only accepts posts from the site itself, and limits each visitor to 5 enquiries per 10 minutes (200 per hour site-wide). Rate limits are stored in Postgres, so they hold across all server instances.

Editing is safe with more than one tab or person: the landing-page draft and each listing carry a revision number, and a save based on an out-of-date copy is refused with a “changed somewhere else — reload” message instead of overwriting newer work. The editor saves in order, retries when the connection drops, saves before you leave for another Studio page, and keeps your work on screen if the session ends (log in again in a new tab, then press Ctrl+S).

## Data

Everything lives in Postgres when `DATABASE_URL` is set: `cms_pages`, `cms_page_versions`, `properties`, `enquiries`, `admin_sessions`, `rate_limits`, `app_meta`. Tables are created on first use (or with `npm run db:migrate`). Sample listings are inserted once per database; a marker in `app_meta` stops them being re-added after you delete them. Without `DATABASE_URL`, local development uses JSON files in `data/`.

## Quality checks

```bash
npm run typecheck        # TypeScript
npm run lint             # ESLint (Next.js + React Hooks rules)
npm test                 # 68 unit + storage tests (add TEST_DATABASE_URL=postgres://… to include Postgres)
E2E_PASSWORD=… npm run e2e   # 35 browser checks against a running server (E2E_BASE_URL, default localhost:3000)
```

`npm run e2e` creates and deletes its own listing and enquiry. `E2E_DESTRUCTIVE=1` also removes all sample listings — only use that against a throwaway database.

## Design rules

The look is deliberately plain and specific: ink on paper, one accent colour, 1px rules instead of shadows and cards, a serif for headings and a sans with tabular figures for data, 4px corners, and no gradients, glows or lift-on-hover. Copy names real places and real data (live listing counts per city and locality) rather than slogans. Listings without photos show a line-drawn elevation (or a survey sketch for plots) instead of a cartoon. The rules are written at the top of `app/globals.css`; new UI should follow them. Gradient and image backgrounds remain available in the CMS, but no default section uses one.

## Project layout

```
app/                    routes (landing, search, property, admin, API)
components/cms/         PageRenderer — one renderer for the public site and the editor canvas
components/admin/       Studio editor, inspector, controls
components/search/      Filters panel
lib/cms/schema.ts       CMS content model, section registry, defaults
lib/cms/store.ts        picks the storage adapter (Postgres or JSON file)
lib/cms/storage/        CmsStorage interface + Postgres and JSON-file adapters
lib/locations.ts        city → locality → area hierarchy (+ coordinates)
lib/search.ts           query parser, filters, facets, close matches
lib/recommend.ts        similarity scoring
lib/seed.ts             deterministic SAMPLE inventory (fictional)
```

## Important notes before production

- **Sample data:** all listings, projects, developers and RERA numbers are **fictional**, generated by `lib/seed.ts`, and carry `isSample: true`. Sample listings show a "Sample listing" tag on cards and the property page, and their RERA panel says the number is illustrative instead of linking to the official portal. Real listings (`isSample: false`) get the portal link. Add real listings in Studio → Listings, then use **Remove sample listings**.
- **Photos:** uploaded in Studio to Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Listings without photos show a line drawing. Landing-page section backgrounds take an image URL.
- **Auth:** a single admin password. Logging in creates a server-side session (12 hours) referenced by a signed, HTTP-only cookie; logging out revokes it. Failed logins are limited per visitor and site-wide. Roles and permissions were not specified.
- **Input:** every API checks the origin, validates the body with a schema (pages, listings, enquiries) and strips invisible control characters before anything reaches the database.

## Not yet built (needs product decisions)
Multiple admin users and roles, adding new cities/localities from Studio (the location list is in `lib/locations.ts`), video, a map, email/SMS alerts for new enquiries, CRM integration, and visitor accounts.

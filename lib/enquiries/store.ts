import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { assertWritableFallback, hasDatabase, iso, newId, pool, withSchema } from "@/lib/db";

export const ENQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export interface Enquiry {
  id: string;
  propertyId: string | null;
  propertyTitle: string | null;
  propertySlug: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  status: EnquiryStatus;
  note: string | null;
  pageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewEnquiry = Pick<Enquiry, "propertyId" | "propertyTitle" | "propertySlug" | "name" | "phone" | "email" | "message" | "pageUrl">;

export interface EnquiryStore {
  create(e: NewEnquiry): Promise<Enquiry>;
  /** Newest first. Without `limit`, returns everything (used by the CSV export). */
  list(opts?: { status?: EnquiryStatus; limit?: number; offset?: number }): Promise<Enquiry[]>;
  counts(): Promise<Record<EnquiryStatus | "all", number>>;
  update(id: string, patch: { status?: EnquiryStatus; note?: string }): Promise<Enquiry | undefined>;
  countNew(): Promise<number>;
}

// --- Postgres ---------------------------------------------------------------

type Row = {
  id: string; property_id: string | null; property_title: string | null; property_slug: string | null; name: string; phone: string;
  email: string | null; message: string; status: EnquiryStatus; note: string | null; page_url: string | null; created_at: Date; updated_at: Date;
};
const fromRow = (r: Row): Enquiry => ({
  id: r.id, propertyId: r.property_id, propertyTitle: r.property_title, propertySlug: r.property_slug, name: r.name, phone: r.phone,
  email: r.email, message: r.message, status: r.status, note: r.note, pageUrl: r.page_url, createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
});

const postgresStore: EnquiryStore = {
  create: (e) =>
    withSchema(async () => {
      const { rows } = await pool().query<Row>(
        `insert into enquiries (id, property_id, property_title, property_slug, name, phone, email, message, page_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [newId("E"), e.propertyId, e.propertyTitle, e.propertySlug, e.name, e.phone, e.email, e.message, e.pageUrl]
      );
      return fromRow(rows[0]);
    }),
  list: (opts = {}) =>
    withSchema(async () => {
      const { rows } = await pool().query<Row>(
        `select * from enquiries where ($1::text is null or status = $1) order by created_at desc, id limit $2 offset $3`,
        [opts.status ?? null, opts.limit ?? null, opts.offset ?? 0]
      );
      return rows.map(fromRow);
    }),
  counts: () =>
    withSchema(async () => {
      const { rows } = await pool().query<{ status: EnquiryStatus; n: string }>(`select status, count(*) as n from enquiries group by status`);
      const out = { all: 0, new: 0, contacted: 0, closed: 0 };
      for (const r of rows) {
        out[r.status] = Number(r.n);
        out.all += Number(r.n);
      }
      return out;
    }),
  update: (id, patch) =>
    withSchema(async () => {
      const { rows } = await pool().query<Row>(
        `update enquiries set status = coalesce($2, status), note = coalesce($3, note), updated_at = now() where id = $1 returning *`,
        [id, patch.status ?? null, patch.note ?? null]
      );
      return rows[0] ? fromRow(rows[0]) : undefined;
    }),
  countNew: () => withSchema(async () => Number((await pool().query(`select count(*) from enquiries where status = 'new'`)).rows[0].count)),
};

// --- JSON file (local development) -------------------------------------------

const FILE = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "enquiries.json");
let queue: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>) => {
  const r = queue.then(fn, fn);
  queue = r.catch(() => undefined);
  return r;
};
const load = async (): Promise<Enquiry[]> => {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
};
const save = async (list: Enquiry[]) => {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 1));
  await fs.rename(tmp, FILE);
};

const jsonStore: EnquiryStore = {
  create: (e) =>
    serial(async () => {
      const now = new Date().toISOString();
      const row: Enquiry = { ...e, id: newId("E"), status: "new", note: null, createdAt: now, updatedAt: now };
      await save([row, ...(await load())]);
      return row;
    }),
  list: async (opts = {}) => {
    const rows = (await load()).filter((e) => !opts.status || e.status === opts.status);
    const start = opts.offset ?? 0;
    return opts.limit === undefined ? rows.slice(start) : rows.slice(start, start + opts.limit);
  },
  counts: async () => {
    const rows = await load();
    const out = { all: rows.length, new: 0, contacted: 0, closed: 0 };
    for (const r of rows) out[r.status]++;
    return out;
  },
  update: (id, patch) =>
    serial(async () => {
      const list = await load();
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return undefined;
      list[i] = { ...list[i], ...(patch.status && { status: patch.status }), ...(patch.note !== undefined && { note: patch.note }), updatedAt: new Date().toISOString() };
      await save(list);
      return list[i];
    }),
  countNew: async () => (await load()).filter((e) => e.status === "new").length,
};

export function enquiryStore(): EnquiryStore {
  if (hasDatabase()) return postgresStore;
  assertWritableFallback("enquiries");
  return jsonStore;
}

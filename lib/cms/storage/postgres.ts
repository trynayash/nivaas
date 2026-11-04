import "server-only";
import { iso, pool, tx, withSchema } from "@/lib/db";
import { defaultPage, type Page } from "../schema";
import { MAX_VERSIONS, type CmsDoc, type CmsStorage } from "./types";

const SLUG = "home";

/** Make sure the landing page row exists (first run, or after a database reset). */
async function ensureRow() {
  const page = JSON.stringify(defaultPage());
  await pool().query(`insert into cms_pages (slug, draft, published) values ($1, $2::jsonb, $2::jsonb) on conflict (slug) do nothing`, [SLUG, page]);
}

type Row = { draft: Page; published: Page; draft_saved_at: Date | null; published_at: Date | null };

async function readRow(): Promise<Row> {
  const q = () => pool().query<Row>(`select draft, published, draft_saved_at, published_at from cms_pages where slug = $1`, [SLUG]);
  let { rows } = await q();
  if (!rows[0]) {
    await ensureRow();
    ({ rows } = await q());
  }
  return rows[0];
}

async function readDoc(): Promise<CmsDoc> {
  const [r, versions] = await Promise.all([
    readRow(),
    pool().query<{ page: Page; published_at: Date }>(
      `select page, published_at from cms_page_versions where slug = $1 order by id desc limit $2`,
      [SLUG, MAX_VERSIONS]
    ),
  ]);
  return {
    draft: r.draft,
    published: r.published,
    draftSavedAt: iso(r.draft_saved_at),
    publishedAt: iso(r.published_at),
    history: versions.rows.map((v) => ({ at: iso(v.published_at)!, page: v.page })),
  };
}

async function publishPage(page: Page): Promise<{ publishedAt: string }> {
  await ensureRow();
  return tx(async (c) => {
    // Lock the row so simultaneous publishes archive versions one after another.
    await c.query(`select 1 from cms_pages where slug = $1 for update`, [SLUG]);
    await c.query(
      `insert into cms_page_versions (slug, page, published_at)
       select slug, published, coalesce(published_at, now()) from cms_pages where slug = $1`,
      [SLUG]
    );
    const { rows } = await c.query<{ published_at: Date }>(
      `update cms_pages
          set draft = $2::jsonb, published = $2::jsonb, draft_saved_at = now(), published_at = now(), updated_at = now()
        where slug = $1
        returning published_at`,
      [SLUG, JSON.stringify(page)]
    );
    await c.query(
      `delete from cms_page_versions
        where slug = $1
          and id not in (select id from cms_page_versions where slug = $1 order by id desc limit $2)`,
      [SLUG, MAX_VERSIONS]
    );
    return { publishedAt: iso(rows[0].published_at)! };
  });
}

export const postgresStorage: CmsStorage = {
  name: "postgres",

  read: () => withSchema(readDoc),

  readPublished: () => withSchema(async () => (await readRow()).published),

  saveDraft: (page: Page) =>
    withSchema(async () => {
      await ensureRow();
      const { rows } = await pool().query<{ draft_saved_at: Date }>(
        `update cms_pages set draft = $2::jsonb, draft_saved_at = now(), updated_at = now() where slug = $1 returning draft_saved_at`,
        [SLUG, JSON.stringify(page)]
      );
      return { draftSavedAt: iso(rows[0].draft_saved_at)! };
    }),

  publish: (page: Page) => withSchema(() => publishPage(page)),
};

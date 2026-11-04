// Create the CMS tables in DATABASE_URL. If data/cms.json exists and the database page has never
// been saved, its draft/published/version history are imported.
//   DATABASE_URL=postgres://… npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { SCHEMA_SQL } from "../lib/cms/storage/sql";
import { defaultPage } from "../lib/cms/schema";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(SCHEMA_SQL);
    console.log("✓ schema ready");
    const file = path.join(process.cwd(), "data", "cms.json");
    const existing = await pool.query(`select draft_saved_at, published_at from cms_pages where slug = 'home'`);
    const untouched = !existing.rows[0] || (!existing.rows[0].draft_saved_at && !existing.rows[0].published_at);
    if (fs.existsSync(file) && untouched) {
      const doc = JSON.parse(fs.readFileSync(file, "utf8"));
      await pool.query("begin");
      await pool.query(
        `insert into cms_pages (slug, draft, published, draft_saved_at, published_at) values ('home', $1::jsonb, $2::jsonb, $3, $4)
         on conflict (slug) do update set draft = excluded.draft, published = excluded.published,
           draft_saved_at = excluded.draft_saved_at, published_at = excluded.published_at, updated_at = now()`,
        [JSON.stringify(doc.draft), JSON.stringify(doc.published), doc.draftSavedAt, doc.publishedAt]
      );
      for (const v of [...(doc.history ?? [])].reverse()) {
        await pool.query(`insert into cms_page_versions (slug, page, published_at) values ('home', $1::jsonb, $2)`, [JSON.stringify(v.page), v.at]);
      }
      await pool.query("commit");
      console.log(`✓ imported data/cms.json (${doc.history?.length ?? 0} versions)`);
    } else if (!existing.rows[0]) {
      const page = JSON.stringify(defaultPage());
      await pool.query(`insert into cms_pages (slug, draft, published) values ('home', $1::jsonb, $1::jsonb) on conflict do nothing`, [page]);
      console.log("✓ seeded default landing page");
    } else {
      console.log("• page already exists — nothing imported");
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

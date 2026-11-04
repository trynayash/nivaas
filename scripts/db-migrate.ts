// Create the CMS tables in DATABASE_URL. If data/cms.json exists and the database page has never
// been saved, its draft/published/version history are imported.
//   DATABASE_URL=postgres://… npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { SCHEMA_SQL, SCHEMA_VERSION } from "../lib/db/schema";
import { defaultPage } from "../lib/cms/schema";
import { validatePage } from "../lib/cms/validate";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  // Same strict SSL handling as the app (see connectionString in lib/db).
  const url = process.env.DATABASE_URL.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(SCHEMA_SQL);
    await pool.query(
      `insert into app_meta (key, value) values ('schema_version', to_jsonb($1::int)) on conflict (key) do update set value = excluded.value`,
      [SCHEMA_VERSION]
    );
    console.log("✓ schema ready");
    const file = path.join(process.cwd(), "data", "cms.json");
    const existing = await pool.query(`select draft_saved_at, published_at from cms_pages where slug = 'home'`);
    const untouched = !existing.rows[0] || (!existing.rows[0].draft_saved_at && !existing.rows[0].published_at);
    if (fs.existsSync(file) && untouched) {
      const doc = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [label, page] of [["draft", doc.draft], ["published", doc.published]] as const) {
        const check = validatePage(page);
        if (!check.ok) throw new Error(`data/cms.json ${label} page is invalid: ${check.error}`);
      }
      const client = await pool.connect();
      try {
      await client.query("begin");
      await client.query(
        `insert into cms_pages (slug, draft, published, draft_saved_at, published_at) values ('home', $1::jsonb, $2::jsonb, $3, $4)
         on conflict (slug) do update set draft = excluded.draft, published = excluded.published,
           draft_saved_at = excluded.draft_saved_at, published_at = excluded.published_at, updated_at = now()`,
        [JSON.stringify(doc.draft), JSON.stringify(doc.published), doc.draftSavedAt, doc.publishedAt]
      );
      for (const v of [...(doc.history ?? [])].reverse()) {
        if (!validatePage(v.page).ok) continue; // skip unusable old versions
        await client.query(`insert into cms_page_versions (slug, page, published_at) values ('home', $1::jsonb, $2)`, [JSON.stringify(v.page), v.at]);
      }
      await client.query("commit");
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
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

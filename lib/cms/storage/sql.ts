// Schema for the Postgres adapter. Idempotent: safe to run on every cold start and from `npm run db:migrate`.
export const SCHEMA_SQL = `
create table if not exists cms_pages (
  slug            text primary key,
  draft           jsonb not null,
  published       jsonb not null,
  draft_saved_at  timestamptz,
  published_at    timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists cms_page_versions (
  id            bigserial primary key,
  slug          text not null references cms_pages(slug) on delete cascade,
  page          jsonb not null,
  published_at  timestamptz not null,
  archived_at   timestamptz not null default now()
);

create index if not exists cms_page_versions_slug_id_idx on cms_page_versions (slug, id desc);
`;

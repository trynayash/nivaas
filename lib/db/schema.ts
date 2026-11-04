// Postgres schema for everything the app stores. Idempotent: safe to run on every cold start
// and from `npm run db:migrate`.
export const SCHEMA_SQL = `
create table if not exists app_meta (
  key    text primary key,
  value  jsonb not null
);

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

create table if not exists properties (
  id          text primary key,
  slug        text not null unique,
  data        jsonb not null,
  published   boolean not null default true,
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists properties_published_idx on properties (published);

create table if not exists enquiries (
  id              text primary key,
  property_id     text,
  property_title  text,
  property_slug   text,
  name            text not null,
  phone           text not null,
  email           text,
  message         text not null,
  status          text not null default 'new',
  note            text,
  page_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists enquiries_created_idx on enquiries (created_at desc);

-- Admin sign-ins. A row per session so logout (and expiry) is enforced on the server.
create table if not exists admin_sessions (
  id          text primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- Revision counters for optimistic concurrency (stale tabs/requests get a 409, not a silent overwrite).
alter table cms_pages  add column if not exists draft_rev integer not null default 0;
alter table properties add column if not exists rev       integer not null default 0;

-- Fixed-window counters shared by every server instance (login attempts, enquiries).
create table if not exists rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  count         integer not null
);
`;

/** Bump when SCHEMA_SQL changes, so running instances re-apply it once. */
export const SCHEMA_VERSION = 3;

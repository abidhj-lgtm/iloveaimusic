-- Seed marker + app metadata (replaces a full table scan on every request)
create table if not exists app_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_meta enable row level security;
alter table app_meta force row level security;
revoke all on public.app_meta from anon, authenticated;

-- Keyset pagination indexes: no offset scans, no total-count query
create index if not exists tracks_ks_new on tracks (created_at desc, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists tracks_ks_old on tracks (created_at asc, id asc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists tracks_ks_liked on tracks (like_count desc, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists tracks_ks_played on tracks (plays desc, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;

-- Batch lookups
create index if not exists tracks_user_created_idx on tracks (user_id, created_at desc);
create index if not exists profiles_name_trgm_idx on profiles using gin (name gin_trgm_ops);
create index if not exists profiles_handle_trgm_idx on profiles using gin (handle gin_trgm_ops);
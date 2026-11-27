-- I Love AI Music — core schema
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

do $$ begin
  create type user_role as enum ('user','creator','moderator','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type auth_provider as enum ('email','google','demo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type track_source as enum ('upload','youtube');
exception when duplicate_object then null; end $$;

do $$ begin
  create type track_status as enum ('draft','processing','published','hidden','removed','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type track_visibility as enum ('public','unlisted','private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_reason as enum ('copyright','spam','hate','explicit_mislabel','broken_media','impersonation','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('open','reviewing','actioned','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  email text not null unique,
  name text not null check (char_length(name) between 2 and 40),
  handle text not null unique check (handle ~ '^[a-z0-9_]{2,24}$'),
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_palette int not null default 0 check (avatar_palette between 0 and 15),
  provider auth_provider not null default 'email',
  role user_role not null default 'creator',
  verified boolean not null default false,
  pass_hash text,
  strikes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_handle_idx on profiles (handle);
create index if not exists profiles_created_idx on profiles (created_at desc);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists auth_sessions_user_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expiry_idx on auth_sessions (expires_at);

create table if not exists auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('verify','reset')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists auth_tokens_user_idx on auth_tokens (user_id, kind);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  source track_source not null,
  status track_status not null default 'draft',
  visibility track_visibility not null default 'public',
  youtube_id text,
  is_live boolean not null default false,
  background text not null default '' check (char_length(background) <= 1200),
  style_prompt text not null default '' check (char_length(style_prompt) <= 600),
  lyrics text not null default '' check (char_length(lyrics) <= 5000),
  instrumental boolean not null default false,
  ai_tool text,
  human_contribution text,
  license text not null default 'all_rights_reserved',
  explicit boolean not null default false,
  rights_attested boolean not null default false,
  duration numeric(8,2),
  loudness numeric(6,2),
  cover_seed text not null default '',
  cover_palette int not null default 0,
  processing_error text,
  plays bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  deleted_at timestamptz,
  constraint tracks_source_payload check (
    (source = 'youtube' and youtube_id is not null) or (source = 'upload')
  )
);
create index if not exists tracks_feed_idx on tracks (published_at desc nulls last, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists tracks_user_idx on tracks (user_id, created_at desc);
create index if not exists tracks_search_idx on tracks using gin (search_vector);
create index if not exists tracks_title_trgm_idx on tracks using gin (title gin_trgm_ops);

create table if not exists track_assets (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  kind text not null check (kind in ('original','stream','cover','waveform','preview')),
  bucket text not null,
  path text not null,
  mime text,
  bytes bigint,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (track_id, kind, path)
);
create index if not exists track_assets_track_idx on track_assets (track_id);

create table if not exists likes (
  user_id uuid not null references profiles(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
create index if not exists likes_track_idx on likes (track_id);

create table if not exists saves (
  user_id uuid not null references profiles(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, target_id),
  constraint follows_not_self check (follower_id <> target_id)
);
create index if not exists follows_target_idx on follows (target_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 400),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists comments_track_idx on comments (track_id, created_at);

create table if not exists plays (
  id bigserial primary key,
  track_id uuid not null references tracks(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  ip_hash text,
  started_at timestamptz not null default now(),
  completed boolean not null default false
);
create index if not exists plays_track_time_idx on plays (track_id, started_at desc);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references tracks(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  reason report_reason not null,
  details text not null default '' check (char_length(details) <= 1000),
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_target check (track_id is not null or comment_id is not null)
);
create index if not exists reports_queue_idx on reports (status, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  target text,
  meta jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on audit_logs (created_at desc);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

drop trigger if exists tracks_touch on tracks;
create trigger tracks_touch before update on tracks
  for each row execute function touch_updated_at();

create or replace function tracks_search_update() returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.style_prompt,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.background,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.lyrics,'')), 'D');
  return new;
end $$;

drop trigger if exists tracks_search on tracks;
create trigger tracks_search before insert or update of title, style_prompt, background, lyrics
  on tracks for each row execute function tracks_search_update();

create or replace function bump_like_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update tracks set like_count = like_count + 1 where id = new.track_id;
  else
    update tracks set like_count = greatest(0, like_count - 1) where id = old.track_id;
  end if;
  return null;
end $$;

drop trigger if exists likes_count on likes;
create trigger likes_count after insert or delete on likes
  for each row execute function bump_like_count();

create or replace function bump_comment_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update tracks set comment_count = comment_count + 1 where id = new.track_id;
  else
    update tracks set comment_count = greatest(0, comment_count - 1) where id = old.track_id;
  end if;
  return null;
end $$;

drop trigger if exists comments_count on comments;
create trigger comments_count after insert or delete on comments
  for each row execute function bump_comment_count();
-- ============================================================
-- 1. PLAYLISTS
-- ============================================================
create table if not exists playlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  description   text not null default '' check (char_length(description) <= 1000),
  cover_path    text,
  cover_seed    text not null default '',
  cover_palette int  not null default 0,
  is_public     boolean not null default true,
  track_count   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists playlists_user_idx   on playlists (user_id, created_at desc);
create index if not exists playlists_public_idx on playlists (created_at desc) where is_public;

create table if not exists playlist_tracks (
  id          uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  track_id    uuid not null references tracks(id)    on delete cascade,
  position    int  not null default 0,
  added_at    timestamptz not null default now(),
  unique (playlist_id, track_id)
);

create index if not exists playlist_tracks_order_idx on playlist_tracks (playlist_id, position);
create index if not exists playlist_tracks_track_idx on playlist_tracks (track_id);

create or replace function recount_playlist_tracks() returns trigger
language plpgsql as $$
begin
  update playlists p
     set track_count = (select count(*) from playlist_tracks pt where pt.playlist_id = p.id),
         updated_at  = now()
   where p.id = coalesce(new.playlist_id, old.playlist_id);
  return null;
end $$;

drop trigger if exists playlist_tracks_recount on playlist_tracks;
create trigger playlist_tracks_recount
after insert or delete or update on playlist_tracks
for each row execute function recount_playlist_tracks();

-- ============================================================
-- 2. NOTIFICATIONS  (dropped first — new feature, no data yet)
-- ============================================================
drop table if exists notifications cascade;

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('like','comment','follow','playlist_add','system')),
  actor_id    uuid references profiles(id)  on delete cascade,
  track_id    uuid references tracks(id)    on delete cascade,
  playlist_id uuid references playlists(id) on delete cascade,
  comment_id  uuid references comments(id)  on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (user_id is distinct from actor_id)
);

create index notifications_user_idx   on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read_at is null;

create unique index notifications_dedup_idx
  on notifications (user_id, kind,
                    coalesce(actor_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where read_at is null;

-- ============================================================
-- 3. TRACK ANALYTICS  (cache table; plays remains source of truth)
-- ============================================================
create table if not exists track_analytics (
  track_id         uuid not null references tracks(id) on delete cascade,
  day              date not null,
  plays            int  not null default 0,
  unique_listeners int  not null default 0,
  geo              jsonb,
  primary key (track_id, day)
);

create index if not exists track_analytics_track_idx on track_analytics (track_id, day desc);

-- ============================================================
-- 4. TRACK TAGS
-- ============================================================
create table if not exists track_tags (
  track_id uuid not null references tracks(id) on delete cascade,
  tag      text not null check (char_length(tag) between 1 and 40),
  primary key (track_id, tag)
);

create index if not exists track_tags_tag_idx on track_tags (tag);

-- ============================================================
-- 5. ANALYTICS READ MODELS  (plays.started_at)
-- ============================================================
create or replace function track_play_series(p_track_id uuid, p_days int default 30)
returns table(day date, plays bigint, unique_listeners bigint)
language sql stable as $$
  select (started_at at time zone 'utc')::date as day,
         count(*)::bigint as plays,
         count(distinct coalesce(user_id::text, ip_hash))::bigint as unique_listeners
    from plays
   where track_id = p_track_id
     and started_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
   group by 1 order by 1;
$$;

create or replace function user_play_series(p_user_id uuid, p_days int default 30)
returns table(day date, plays bigint, unique_listeners bigint)
language sql stable as $$
  select (pl.started_at at time zone 'utc')::date as day,
         count(*)::bigint as plays,
         count(distinct coalesce(pl.user_id::text, pl.ip_hash))::bigint as unique_listeners
    from plays pl
    join tracks t on t.id = pl.track_id
   where t.user_id = p_user_id
     and t.deleted_at is null
     and pl.started_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
   group by 1 order by 1;
$$;

create or replace function user_top_tracks(p_user_id uuid, p_days int default 30, p_limit int default 10)
returns table(track_id uuid, title text, plays bigint, unique_listeners bigint)
language sql stable as $$
  select t.id, t.title,
         count(*)::bigint as plays,
         count(distinct coalesce(pl.user_id::text, pl.ip_hash))::bigint as unique_listeners
    from tracks t
    join plays pl on pl.track_id = t.id
   where t.user_id = p_user_id
     and t.deleted_at is null
     and pl.started_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
   group by t.id, t.title
   order by plays desc
   limit greatest(1, least(p_limit, 50));
$$;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
alter table playlists       enable row level security;
alter table playlist_tracks enable row level security;
alter table notifications   enable row level security;
alter table track_analytics enable row level security;
alter table track_tags      enable row level security;

drop policy if exists playlists_read on playlists;
create policy playlists_read on playlists for select
  using (is_public or user_id = auth.uid());

drop policy if exists playlists_write on playlists;
create policy playlists_write on playlists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists playlist_tracks_read on playlist_tracks;
create policy playlist_tracks_read on playlist_tracks for select
  using (exists (select 1 from playlists p where p.id = playlist_id and (p.is_public or p.user_id = auth.uid())));

drop policy if exists playlist_tracks_write on playlist_tracks;
create policy playlist_tracks_write on playlist_tracks for all
  using (exists (select 1 from playlists p where p.id = playlist_id and p.user_id = auth.uid()))
  with check (exists (select 1 from playlists p where p.id = playlist_id and p.user_id = auth.uid()));

drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications for select using (user_id = auth.uid());

drop policy if exists analytics_read on track_analytics;
create policy analytics_read on track_analytics for select
  using (exists (select 1 from tracks t where t.id = track_id and (t.visibility = 'public' or t.user_id = auth.uid())));

drop policy if exists tags_read on track_tags;
create policy tags_read on track_tags for select using (true);
-- Account lifecycle
alter table profiles add column if not exists deleted_at timestamptz;
alter table profiles add column if not exists anonymized boolean not null default false;

-- Direct media lookup (replaces scanning a feed window)
create index if not exists tracks_audio_path_idx on tracks (audio_path) where audio_path is not null;
create index if not exists tracks_cover_path_idx on tracks (cover_path) where cover_path is not null;

-- Keyset pagination indexes
create index if not exists tracks_keyset_new_idx on tracks (created_at desc, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists tracks_keyset_liked_idx on tracks (like_count desc, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;
create index if not exists tracks_keyset_played_idx on tracks (plays desc, id desc)
  where status = 'published' and visibility = 'public' and deleted_at is null;

-- Atomic counters: no read-modify-write races
create or replace function bump_plays(p_track_id uuid, p_by int default 1)
returns bigint language sql security definer as $$
  update tracks set plays = greatest(0, plays + p_by) where id = p_track_id returning plays;
$$;

create or replace function recount_track(p_track_id uuid)
returns void language sql security definer as $$
  update tracks t set
    like_count = (select count(*) from likes l where l.track_id = p_track_id),
    comment_count = (select count(*) from comments c where c.track_id = p_track_id and c.deleted_at is null)
  where t.id = p_track_id;
$$;

revoke execute on function bump_plays(uuid, int) from anon, authenticated;
revoke execute on function recount_track(uuid) from anon, authenticated;

-- Restore support for comments (moderation undo)
create index if not exists comments_deleted_idx on comments (deleted_at) where deleted_at is not null;

-- Admin list indexes
create index if not exists tracks_status_idx on tracks (status, created_at desc);
create index if not exists profiles_deleted_idx on profiles (deleted_at) where deleted_at is not null;
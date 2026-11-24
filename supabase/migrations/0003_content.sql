alter table tracks add column if not exists preset text;
alter table tracks add column if not exists audio_path text;
alter table tracks add column if not exists cover_path text;
alter table tracks add column if not exists audio_mime text;
alter table tracks add column if not exists audio_bytes bigint;

alter table tracks drop constraint if exists tracks_preset_check;
alter table tracks add constraint tracks_preset_check
  check (preset is null or preset in ('synthwave','lofi','ambient'));

create index if not exists tracks_status_created_idx on tracks (status, created_at desc, id desc);
create index if not exists tracks_deleted_idx on tracks (deleted_at) where deleted_at is not null;

create or replace function public_track_visible(t tracks) returns boolean
language sql stable as $$
  select t.status = 'published' and t.visibility = 'public' and t.deleted_at is null
$$;
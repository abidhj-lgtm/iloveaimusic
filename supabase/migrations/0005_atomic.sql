-- Atomic play counter: removes the read-modify-write race.
create or replace function increment_plays(p_track_id uuid, p_by int default 1)
returns bigint language sql volatile as $$
  update tracks set plays = plays + p_by where id = p_track_id returning plays;
$$;

revoke execute on function increment_plays(uuid, int) from anon, authenticated;

-- Restore a soft-deleted comment (used by moderation undo).
create or replace function restore_comment(p_comment_id uuid)
returns void language sql volatile as $$
  update comments set deleted_at = null where id = p_comment_id;
$$;

revoke execute on function restore_comment(uuid) from anon, authenticated;

-- Keep the denormalised comment count honest after a restore.
create or replace function recount_comments(p_track_id uuid)
returns void language sql volatile as $$
  update tracks set comment_count = (
    select count(*) from comments where track_id = p_track_id and deleted_at is null
  ) where id = p_track_id;
$$;

revoke execute on function recount_comments(uuid) from anon, authenticated;
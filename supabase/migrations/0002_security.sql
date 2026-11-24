-- Defense in depth: the browser never talks to Postgres directly.
-- Every read/write goes through server code using the service role,
-- which performs explicit ownership and role checks.
-- Client roles are denied everything by default.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','auth_sessions','auth_tokens','tracks','track_assets',
    'likes','saves','follows','comments','plays','reports',
    'notifications','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

-- Service role bypasses RLS; these policies document intent and keep
-- the door closed even if a client key is ever exposed.
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists tracks_public_read on tracks;
create policy tracks_public_read on tracks
  for select to authenticated
  using (
    status = 'published' and visibility = 'public' and deleted_at is null
  );

drop policy if exists tracks_owner_write on tracks;
create policy tracks_owner_write on tracks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists likes_owner on likes;
create policy likes_owner on likes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists saves_owner on saves;
create policy saves_owner on saves
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists comments_owner on comments;
create policy comments_owner on comments
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage: originals private, derivatives public via CDN.
insert into storage.buckets (id, name, public)
values ('audio-originals','audio-originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('audio-streams','audio-streams', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers','covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars','avatars', true)
on conflict (id) do nothing;

drop policy if exists originals_no_client_access on storage.objects;
create policy originals_no_client_access on storage.objects
  for all to anon, authenticated
  using (bucket_id <> 'audio-originals')
  with check (bucket_id <> 'audio-originals');

drop policy if exists public_read_derivatives on storage.objects;
create policy public_read_derivatives on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('audio-streams','covers','avatars'));
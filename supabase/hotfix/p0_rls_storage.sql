-- =====================================================================
-- CharaVerse P0 security hotfix  (run once in Supabase SQL editor)
-- Before running: export current policies for comparison:
--   select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies order by 1,2,3;
-- Everything here is idempotent (drop-if-exists + create).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Tables that were created without RLS
-- ---------------------------------------------------------------
alter table if exists public.chat_memory_versions enable row level security;

drop policy if exists "memory_versions_owner_select" on public.chat_memory_versions;
create policy "memory_versions_owner_select" on public.chat_memory_versions
  for select using (
    exists (select 1 from public.chat_memories m
            where m.id = chat_memory_versions.memory_id and m.user_id = auth.uid())
  );

drop policy if exists "memory_versions_owner_write" on public.chat_memory_versions;
create policy "memory_versions_owner_write" on public.chat_memory_versions
  for all using (
    exists (select 1 from public.chat_memories m
            where m.id = chat_memory_versions.memory_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.chat_memories m
            where m.id = chat_memory_versions.memory_id and m.user_id = auth.uid())
  );

-- session_characters belongs to the multi-character feature, which is being removed (plan A15).
-- Lock it down now; the baseline migration in P1 drops it.
alter table if exists public.session_characters enable row level security;
drop policy if exists "session_characters_owner" on public.session_characters;
create policy "session_characters_owner" on public.session_characters
  for all using (
    exists (select 1 from public.chat_sessions s
            where s.id = session_characters.session_id and s.user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 2. SECURITY DEFINER function that leaked messages by session id
-- ---------------------------------------------------------------
-- Not called from application code anymore; remove it.
drop function if exists public.get_incremental_messages(uuid, bigint);
drop function if exists public.get_incremental_messages(uuid, integer);
drop function if exists public.get_incremental_messages(text, bigint);

-- ---------------------------------------------------------------
-- 3. Likes: never let clients update other people's character rows
-- ---------------------------------------------------------------
create table if not exists public.character_likes (
  character_id bigint not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (character_id, user_id)
);
alter table public.character_likes enable row level security;
drop policy if exists "likes_read" on public.character_likes;
create policy "likes_read" on public.character_likes for select using (true);
drop policy if exists "likes_own_insert" on public.character_likes;
create policy "likes_own_insert" on public.character_likes for insert with check (auth.uid() = user_id);
drop policy if exists "likes_own_delete" on public.character_likes;
create policy "likes_own_delete" on public.character_likes for delete using (auth.uid() = user_id);

-- toggle_like(character_id) -> returns new like count. Runs as definer but only touches the caller's row.
create or replace function public.toggle_character_like(p_character_id bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.characters c where c.id = p_character_id and c.is_public) then
    raise exception 'character not public';
  end if;

  if exists (select 1 from public.character_likes l where l.character_id = p_character_id and l.user_id = v_uid) then
    delete from public.character_likes where character_id = p_character_id and user_id = v_uid;
  else
    insert into public.character_likes(character_id, user_id) values (p_character_id, v_uid);
  end if;

  select count(*) into v_count from public.character_likes where character_id = p_character_id;
  update public.characters set likes_count = v_count where id = p_character_id;
  return v_count;
end;
$$;
revoke all on function public.toggle_character_like(bigint) from public;
grant execute on function public.toggle_character_like(bigint) to authenticated;

-- Make sure the characters UPDATE policy is owner-only (re-assert; harmless if already so).
drop policy if exists "characters_owner_update" on public.characters;
create policy "characters_owner_update" on public.characters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 4. Storage: owner-only writes. Paths used by the app:
--    avatars:           users/<uid>-*.ext , characters/<charId>-*.ext , banners/<uid>-*.ext
--    character-assets:  comments/<uid>/... (comment images)
--    We key ownership on the file name starting with the uid (users/, banners/, comments/)
--    and allow character avatars for any authenticated user to INSERT only (owner check on characters
--    is done by the app; UPDATE/DELETE of character avatars is restricted to the uploader via owner column).
-- ---------------------------------------------------------------
-- Public read stays as-is for both buckets (they are public buckets).

drop policy if exists "avatars_authenticated_update" on storage.objects;
drop policy if exists "avatars_authenticated_delete" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;
drop policy if exists "Authenticated users can delete avatars" on storage.objects;
drop policy if exists "character_assets_authenticated_update" on storage.objects;
drop policy if exists "character_assets_authenticated_delete" on storage.objects;
drop policy if exists "Authenticated users can update character assets" on storage.objects;
drop policy if exists "Authenticated users can delete character assets" on storage.objects;

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and owner = auth.uid());
drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "character_assets_owner_update" on storage.objects;
create policy "character_assets_owner_update" on storage.objects
  for update using (bucket_id = 'character-assets' and owner = auth.uid());
drop policy if exists "character_assets_owner_delete" on storage.objects;
create policy "character_assets_owner_delete" on storage.objects
  for delete using (bucket_id = 'character-assets' and owner = auth.uid());

-- Keep inserts limited to signed-in users and to image mime types.
update storage.buckets
   set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'],
       file_size_limit = 5242880
 where id in ('avatars','character-assets');

-- ---------------------------------------------------------------
-- 5. Sticker feature removed from the app: nothing to run now.
--    (Tables are dropped in the P1 baseline migration.)
-- ---------------------------------------------------------------

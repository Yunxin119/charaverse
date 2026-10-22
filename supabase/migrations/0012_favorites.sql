-- =====================================================================
-- CharaVerse v2 · favorites (private bookmarks of public characters)
-- Run in the Supabase SQL editor (idempotent).
-- =====================================================================

create table if not exists public.character_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id bigint not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
create index if not exists character_favorites_character_idx on public.character_favorites(character_id);

alter table public.character_favorites enable row level security;

-- Favorites are private: only the owner can see or change their own list.
drop policy if exists "favorites_own_select" on public.character_favorites;
create policy "favorites_own_select" on public.character_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "favorites_own_insert" on public.character_favorites;
create policy "favorites_own_insert" on public.character_favorites
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.characters c where c.id = character_id and c.is_public = true)
  );

drop policy if exists "favorites_own_delete" on public.character_favorites;
create policy "favorites_own_delete" on public.character_favorites
  for delete using (auth.uid() = user_id);

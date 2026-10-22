-- =====================================================================
-- CharaVerse v2 · social: comment replies, per-character chat stats, user stats
-- Run in the Supabase SQL editor (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Comment replies (one level: parent_id points at a top-level comment)
--    + the character's author may delete any comment under their character
-- ---------------------------------------------------------------
alter table public.character_comments
  add column if not exists parent_id bigint references public.character_comments(id) on delete cascade;
create index if not exists character_comments_parent_idx on public.character_comments(parent_id);

drop policy if exists "character_author_can_delete_comments" on public.character_comments;
create policy "character_author_can_delete_comments" on public.character_comments
  for delete using (
    exists (select 1 from public.characters c where c.id = character_comments.character_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 2. Public, aggregate-only chat stats per character (no content, no who)
--    session_count = sessions with at least one user message
--    turn_count    = user messages
-- ---------------------------------------------------------------
create table if not exists public.character_stats (
  character_id bigint primary key references public.characters(id) on delete cascade,
  session_count integer not null default 0,
  turn_count bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.character_stats enable row level security;
drop policy if exists "character_stats_public_read" on public.character_stats;
create policy "character_stats_public_read" on public.character_stats for select using (true);
-- no insert/update/delete policies: only the trigger below (security definer) writes

create or replace function public.bump_character_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_character_id bigint;
  v_first boolean;
begin
  if new.role <> 'user' then return new; end if;
  select character_id into v_character_id from chat_sessions where id = new.session_id;
  if v_character_id is null then return new; end if;
  select not exists (
    select 1 from chat_messages m where m.session_id = new.session_id and m.role = 'user' and m.id <> new.id
  ) into v_first;
  insert into character_stats (character_id, session_count, turn_count, updated_at)
  values (v_character_id, case when v_first then 1 else 0 end, 1, now())
  on conflict (character_id) do update
    set turn_count = character_stats.turn_count + 1,
        session_count = character_stats.session_count + (case when v_first then 1 else 0 end),
        updated_at = now();
  return new;
end $$;

drop trigger if exists chat_messages_bump_stats on public.chat_messages;
create trigger chat_messages_bump_stats after insert on public.chat_messages
  for each row execute function public.bump_character_stats();

-- backfill from existing data (idempotent: recomputes everything)
insert into public.character_stats (character_id, session_count, turn_count, updated_at)
select s.character_id,
       count(distinct s.id) filter (where m.role = 'user'),
       count(*) filter (where m.role = 'user'),
       now()
  from public.chat_sessions s
  join public.chat_messages m on m.session_id = s.id
 group by s.character_id
on conflict (character_id) do update
  set session_count = excluded.session_count, turn_count = excluded.turn_count, updated_at = now();

-- ---------------------------------------------------------------
-- 3. Stats for the signed-in user (private; RLS-scoped via security invoker)
-- ---------------------------------------------------------------
create or replace function public.get_my_stats()
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  select jsonb_build_object(
    'sessions',        (select count(*) from chat_sessions where user_id = auth.uid()),
    'turns',           (select count(*) from chat_messages m join chat_sessions s on s.id = m.session_id where s.user_id = auth.uid() and m.role = 'user'),
    'chars_typed',     (select coalesce(sum(length(m.content)), 0) from chat_messages m join chat_sessions s on s.id = m.session_id where s.user_id = auth.uid() and m.role = 'user'),
    'chars_received',  (select coalesce(sum(length(m.content)), 0) from chat_messages m join chat_sessions s on s.id = m.session_id where s.user_id = auth.uid() and m.role = 'assistant'),
    'characters',      (select count(*) from characters where user_id = auth.uid()),
    'published',       (select count(*) from characters where user_id = auth.uid() and is_public),
    'likes_received',  (select coalesce(sum(likes_count), 0) from characters where user_id = auth.uid()),
    'memories',        (select count(*) from chat_memories where user_id = auth.uid() and is_enabled)
  );
$$;
grant execute on function public.get_my_stats() to authenticated;

-- ---------------------------------------------------------------
-- 4. Public stats for an author page (aggregates over their public characters only)
-- ---------------------------------------------------------------
create or replace function public.get_author_stats(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'characters_public', (select count(*) from characters where user_id = p_user_id and is_public),
    'likes_total',       (select coalesce(sum(likes_count), 0) from characters where user_id = p_user_id and is_public),
    'sessions_total',    (select coalesce(sum(st.session_count), 0) from character_stats st join characters c on c.id = st.character_id where c.user_id = p_user_id and c.is_public),
    'turns_total',       (select coalesce(sum(st.turn_count), 0) from character_stats st join characters c on c.id = st.character_id where c.user_id = p_user_id and c.is_public),
    'joined_at',         (select created_at from profiles where id = p_user_id)
  );
$$;
grant execute on function public.get_author_stats(uuid) to anon, authenticated;

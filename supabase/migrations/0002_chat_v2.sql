-- =====================================================================
-- CharaVerse v2 · Phase 2: chat core
-- Run in the Supabase SQL editor (idempotent). 0001_baseline.sql is the dump
-- of the pre-v2 schema; this file only adds what the new chat needs.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Message alternatives ("swipes") + per-message metadata
-- ---------------------------------------------------------------
alter table public.chat_messages
  add column if not exists swipes jsonb not null default '[]'::jsonb,   -- text[] of alternative replies; content = swipes[swipe_index] once populated
  add column if not exists swipe_index integer not null default 0,
  add column if not exists meta jsonb not null default '{}'::jsonb;      -- { model, finishReason, usage, presetId, ... }

-- ---------------------------------------------------------------
-- 2. Per-session settings move from localStorage into the DB
--    { model, connectionId, presetId, context: { maxTokens, keepRecent }, background: { url }, skin: { enabled } }
-- ---------------------------------------------------------------
alter table public.chat_sessions
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists parent_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists branched_from_message_id bigint;

create index if not exists chat_sessions_parent_idx on public.chat_sessions(parent_session_id);

-- keep updated_at fresh when settings or title change
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists chat_sessions_touch on public.chat_sessions;
create trigger chat_sessions_touch before update on public.chat_sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 3. User presets (SillyTavern-style, see docs/REFACTOR_PLAN.md §5.6)
-- ---------------------------------------------------------------
create table if not exists public.user_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_presets_user_idx on public.user_presets(user_id);
-- at most one default per user
create unique index if not exists user_presets_one_default
  on public.user_presets(user_id) where is_default;

alter table public.user_presets enable row level security;
drop policy if exists "presets_owner_all" on public.user_presets;
create policy "presets_owner_all" on public.user_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists user_presets_touch on public.user_presets;
create trigger user_presets_touch before update on public.user_presets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- 4. Chat backgrounds: private-per-user storage instead of base64 in localStorage
--    Path convention: <uid>/<sessionId>.<ext>
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-backgrounds', 'chat-backgrounds', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "chat_bg_public_read" on storage.objects;
create policy "chat_bg_public_read" on storage.objects
  for select using (bucket_id = 'chat-backgrounds');
drop policy if exists "chat_bg_owner_insert" on storage.objects;
create policy "chat_bg_owner_insert" on storage.objects
  for insert with check (bucket_id = 'chat-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "chat_bg_owner_update" on storage.objects;
create policy "chat_bg_owner_update" on storage.objects
  for update using (bucket_id = 'chat-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "chat_bg_owner_delete" on storage.objects;
create policy "chat_bg_owner_delete" on storage.objects
  for delete using (bucket_id = 'chat-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------
-- 5. Atomic "append a swipe" so two regenerations cannot race
-- ---------------------------------------------------------------
create or replace function public.append_message_swipe(p_message_id bigint, p_content text, p_meta jsonb default '{}'::jsonb)
returns public.chat_messages
language plpgsql
security invoker
as $$
declare
  m public.chat_messages;
begin
  update public.chat_messages
     set swipes = case when jsonb_array_length(swipes) = 0
                       then jsonb_build_array(content, p_content)
                       else swipes || to_jsonb(p_content) end,
         swipe_index = case when jsonb_array_length(swipes) = 0 then 1 else jsonb_array_length(swipes) end,
         content = p_content,
         meta = coalesce(meta, '{}'::jsonb) || p_meta
   where id = p_message_id
   returning * into m;
  if not found then
    raise exception 'message % not found or not yours', p_message_id;
  end if;
  return m;
end $$;
grant execute on function public.append_message_swipe(bigint, text, jsonb) to authenticated;

-- select a swipe (content follows the chosen alternative)
create or replace function public.select_message_swipe(p_message_id bigint, p_index integer)
returns public.chat_messages
language plpgsql
security invoker
as $$
declare
  m public.chat_messages;
begin
  update public.chat_messages
     set swipe_index = p_index,
         content = swipes ->> p_index
   where id = p_message_id
     and p_index >= 0 and p_index < jsonb_array_length(swipes)
   returning * into m;
  if not found then
    raise exception 'invalid swipe index';
  end if;
  return m;
end $$;
grant execute on function public.select_message_swipe(bigint, integer) to authenticated;

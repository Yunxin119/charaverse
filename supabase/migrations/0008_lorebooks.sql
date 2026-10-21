-- =====================================================================
-- CharaVerse v2 · world books (lorebooks)
-- Run in the Supabase SQL editor (idempotent).
--   characters.lorebook : book embedded in the card (travels with the published snapshot)
--   lorebooks           : the user's library; enabled books apply to every chat of that user
-- =====================================================================
alter table public.characters
  add column if not exists lorebook jsonb not null default '{}'::jsonb;

create table if not exists public.lorebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lorebooks_user_idx on public.lorebooks(user_id);

alter table public.lorebooks enable row level security;
drop policy if exists "lorebooks_owner_all" on public.lorebooks;
create policy "lorebooks_owner_all" on public.lorebooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists lorebooks_touch on public.lorebooks;
create trigger lorebooks_touch before update on public.lorebooks
  for each row execute function public.touch_updated_at();

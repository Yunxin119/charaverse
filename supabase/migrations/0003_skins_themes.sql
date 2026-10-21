-- =====================================================================
-- CharaVerse v2 · Phase 3: author skins + user themes
-- Run in the Supabase SQL editor (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Character skin: { version, css, regexScripts[], renderHtml, allowedUrlHosts[] }
--    Backfilled from the legacy prompt_template->>'custom_css'.
-- ---------------------------------------------------------------
alter table public.characters
  add column if not exists skin jsonb not null default '{}'::jsonb;

update public.characters
   set skin = jsonb_build_object('version', 1, 'css', prompt_template->>'custom_css')
 where (skin = '{}'::jsonb or skin is null)
   and coalesce(prompt_template->>'custom_css', '') <> '';

-- ---------------------------------------------------------------
-- 2. User themes (imported JSON theme files, plan §5.4)
-- ---------------------------------------------------------------
create table if not exists public.user_themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_themes_user_idx on public.user_themes(user_id);
create unique index if not exists user_themes_one_active on public.user_themes(user_id) where is_active;

alter table public.user_themes enable row level security;
drop policy if exists "themes_owner_all" on public.user_themes;
create policy "themes_owner_all" on public.user_themes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists user_themes_touch on public.user_themes;
create trigger user_themes_touch before update on public.user_themes
  for each row execute function public.touch_updated_at();

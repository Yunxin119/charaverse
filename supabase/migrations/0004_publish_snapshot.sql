-- =====================================================================
-- CharaVerse v2 · Phase 4: publish-as-snapshot (plan §3 A12)
-- Run in the Supabase SQL editor (idempotent).
--
-- Contract
--   * Everything a *public reader* sees — explore grid, /character/public/[id],
--     other users' chats with the character, and forks ("复制到我的角色") —
--     comes from `published_snapshot`. It is a frozen copy taken when the
--     author clicks 「发布」/「更新发布」.
--   * The live row (`name`, `avatar_url`, `prompt_template`, `skin`) stays the
--     author's private draft. Editing it never changes what the public sees
--     until the author re-publishes.
--   * `is_public` remains the listing flag: true = listed on explore and
--     readable by others; false = hidden (the snapshot is kept so re-publishing
--     is cheap and old chats keep working).
--   * `published_at` is the time of the last (re)publish; explore's 最新 sort
--     and the partial index below use it.
--
-- Snapshot shape (version 1):
--   { "version": 1,
--     "name": text,
--     "avatar_url": text | null,
--     "prompt_template": jsonb (the card JSON, minus `custom_css`),
--     "skin": jsonb (css / regexScripts / renderHtml / allowedUrlHosts) }
-- =====================================================================

alter table public.characters
  add column if not exists published_snapshot jsonb,
  add column if not exists published_at timestamptz;

comment on column public.characters.published_snapshot is
  'Frozen public copy {version,name,avatar_url,prompt_template,skin}. Public readers (explore, public page, other users'' chats, forks) read ONLY this; the live columns are the author''s private draft. Rewritten on every 发布/更新发布.';
comment on column public.characters.published_at is
  'Timestamp of the last (re)publish; null = never published.';

-- Backfill: characters that were already public get a snapshot of their
-- current row so they keep showing up on explore after the readers switch.
update public.characters
   set published_snapshot = jsonb_build_object(
         'version', 1,
         'name', name,
         'avatar_url', avatar_url,
         'prompt_template', coalesce(prompt_template, '{}'::jsonb) - 'custom_css',
         'skin', coalesce(skin, '{}'::jsonb)
       ),
       published_at = coalesce(updated_at, created_at, now())
 where is_public = true
   and published_snapshot is null;

create index if not exists characters_public_published_idx
  on public.characters (published_at desc)
  where is_public;

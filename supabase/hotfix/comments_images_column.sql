-- One-off: character_comments.images was referenced by the app but never created on this DB
-- (v1's add_comment_images_support.sql was skipped). Also part of 0011 now; safe to run twice.
alter table public.character_comments
  add column if not exists images jsonb not null default '[]'::jsonb;

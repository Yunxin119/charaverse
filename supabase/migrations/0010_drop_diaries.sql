-- 0010: drop the diary feature (routes, page and components removed in iteration 3). Idempotent.
drop table if exists public.diaries cascade;
alter table public.chat_sessions
  drop column if exists last_diary_cutoff_message_id,
  drop column if exists last_forum_cutoff_message_id;

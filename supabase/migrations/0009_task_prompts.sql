-- =====================================================================
-- CharaVerse v2 · editable task prompts (summary / memory extraction)
-- Run in the Supabase SQL editor (idempotent).
-- One row per (user, task); `data` holds the whole prompt config (lib/tasks/summary.ts).
-- =====================================================================
create table if not exists public.user_task_prompts (
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, task)
);
alter table public.user_task_prompts enable row level security;
drop policy if exists "task_prompts_owner_all" on public.user_task_prompts;
create policy "task_prompts_owner_all" on public.user_task_prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists user_task_prompts_touch on public.user_task_prompts;
create trigger user_task_prompts_touch before update on public.user_task_prompts
  for each row execute function public.touch_updated_at();

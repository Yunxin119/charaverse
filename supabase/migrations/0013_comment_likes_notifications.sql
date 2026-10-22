-- =====================================================================
-- CharaVerse v2 · comment likes + in-app notifications
-- Run in the Supabase SQL editor (idempotent).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Comment likes (public count on the comment, one row per user)
-- ---------------------------------------------------------------
alter table public.character_comments
  add column if not exists likes_count integer not null default 0;

create table if not exists public.comment_likes (
  comment_id bigint not null references public.character_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_likes enable row level security;
drop policy if exists "comment_likes_read" on public.comment_likes;
create policy "comment_likes_read" on public.comment_likes for select using (true);
-- writes only through the RPC below (security definer), so no insert/delete policies

create or replace function public.toggle_comment_like(p_comment_id bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from character_comments cc join characters c on c.id = cc.character_id
     where cc.id = p_comment_id and c.is_public = true
  ) then raise exception 'comment not found'; end if;

  if exists (select 1 from comment_likes where comment_id = p_comment_id and user_id = v_uid) then
    delete from comment_likes where comment_id = p_comment_id and user_id = v_uid;
  else
    insert into comment_likes(comment_id, user_id) values (p_comment_id, v_uid);
  end if;

  select count(*) into v_count from comment_likes where comment_id = p_comment_id;
  update character_comments set likes_count = v_count where id = p_comment_id;
  return v_count;
end $$;
revoke all on function public.toggle_comment_like(bigint) from public;
grant execute on function public.toggle_comment_like(bigint) to authenticated;

-- ---------------------------------------------------------------
-- 2. Notifications (private inbox; rows are written by triggers only)
--    kind: 'reply'   someone replied to your comment
--          'comment' someone commented under your character
-- ---------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reply', 'comment')),
  actor_id uuid references auth.users(id) on delete cascade,
  character_id bigint references public.characters(id) on delete cascade,
  comment_id bigint references public.character_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "notifications_own_delete" on public.notifications;
create policy "notifications_own_delete" on public.notifications for delete using (auth.uid() = user_id);

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_parent_author uuid;
begin
  select user_id into v_author from characters where id = new.character_id;

  if new.parent_id is not null then
    select user_id into v_parent_author from character_comments where id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> new.user_id then
      insert into notifications(user_id, kind, actor_id, character_id, comment_id)
      values (v_parent_author, 'reply', new.user_id, new.character_id, new.id);
    end if;
    -- the character's author also hears about replies under their character (unless already notified)
    if v_author is not null and v_author <> new.user_id and v_author is distinct from v_parent_author then
      insert into notifications(user_id, kind, actor_id, character_id, comment_id)
      values (v_author, 'comment', new.user_id, new.character_id, new.id);
    end if;
  elsif v_author is not null and v_author <> new.user_id then
    insert into notifications(user_id, kind, actor_id, character_id, comment_id)
    values (v_author, 'comment', new.user_id, new.character_id, new.id);
  end if;
  return new;
end $$;

drop trigger if exists character_comments_notify on public.character_comments;
create trigger character_comments_notify after insert on public.character_comments
  for each row execute function public.notify_on_comment();

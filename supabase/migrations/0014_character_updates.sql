-- =====================================================================
-- CharaVerse v2 · copies keep a link to their source; author update notes
-- Run in the Supabase SQL editor (idempotent).
-- =====================================================================

-- A copy made from a public character remembers where it came from and which
-- published version it is based on, so the chat can show the original's comments
-- and offer an upgrade when the author re-publishes.
alter table public.characters
  add column if not exists source_character_id bigint references public.characters(id) on delete set null,
  add column if not exists source_published_at timestamptz,
  add column if not exists release_note text;
create index if not exists characters_source_idx on public.characters(source_character_id);

-- notifications: free-form payload + the new kind
alter table public.notifications
  add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('reply', 'comment', 'character_update'));

-- When an author (re)publishes, tell everyone who copied or favorited the character.
create or replace function public.notify_on_character_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_public or new.published_at is null or new.published_at is not distinct from old.published_at then
    return new;
  end if;

  -- one notification per user who holds a copy (their newest copy wins)
  insert into notifications(user_id, kind, actor_id, character_id, payload)
  select distinct on (c.user_id) c.user_id, 'character_update', new.user_id, new.id,
         jsonb_build_object('copy_id', c.id, 'note', new.release_note)
    from characters c
   where c.source_character_id = new.id and c.user_id <> new.user_id
   order by c.user_id, c.created_at desc;

  -- favorites without a copy
  insert into notifications(user_id, kind, actor_id, character_id, payload)
  select f.user_id, 'character_update', new.user_id, new.id, jsonb_build_object('note', new.release_note)
    from character_favorites f
   where f.character_id = new.id and f.user_id <> new.user_id
     and not exists (select 1 from characters c where c.source_character_id = new.id and c.user_id = f.user_id);

  return new;
end $$;

drop trigger if exists characters_notify_publish on public.characters;
create trigger characters_notify_publish after update of published_at on public.characters
  for each row execute function public.notify_on_character_publish();

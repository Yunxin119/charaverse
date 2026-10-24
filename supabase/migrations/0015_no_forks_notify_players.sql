-- =====================================================================
-- CharaVerse v2 · remove character copying; publish notes go to players + favorites
-- Run in the Supabase SQL editor (idempotent).
-- =====================================================================

-- Copying a public character into your own library is gone (authorship stays with the
-- author; everyone else chats with the published snapshot). Drop the copy linkage.
drop index if exists public.characters_source_idx;
alter table public.characters
  drop column if exists source_character_id,
  drop column if exists source_published_at;

-- On (re)publish: notify everyone who has chatted with the character or favorited it.
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

  insert into notifications(user_id, kind, actor_id, character_id, payload)
  select u.user_id, 'character_update', new.user_id, new.id, jsonb_build_object('note', new.release_note)
    from (
      select s.user_id from chat_sessions s where s.character_id = new.id
      union
      select f.user_id from character_favorites f where f.character_id = new.id
    ) u
   where u.user_id <> new.user_id;

  return new;
end $$;

drop trigger if exists characters_notify_publish on public.characters;
create trigger characters_notify_publish after update of published_at on public.characters
  for each row execute function public.notify_on_character_publish();

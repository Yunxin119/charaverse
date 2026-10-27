-- =====================================================================
-- CharaVerse v2 · user personas
-- Run in the Supabase SQL editor (idempotent).
--   user_personas     : who the user is in a story; managed at /settings/personas,
--                       never part of a character card (so sharing a card does not share it)
--   persona_bindings  : per user, the persona to use with one character by default;
--                       any session can still pick another one (settings.personaId)
-- =====================================================================

create table if not exists public.user_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  avatar_url text,
  age text not null default '' check (char_length(age) <= 40),
  gender text not null default '' check (gender in ('', 'male', 'female', 'none', 'other')),
  details text not null default '' check (char_length(details) <= 20000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_personas_user_idx on public.user_personas(user_id);
-- at most one default per user
create unique index if not exists user_personas_one_default on public.user_personas(user_id) where is_default;

alter table public.user_personas enable row level security;
drop policy if exists "personas_owner_all" on public.user_personas;
create policy "personas_owner_all" on public.user_personas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists user_personas_touch on public.user_personas;
create trigger user_personas_touch before update on public.user_personas
  for each row execute function public.touch_updated_at();

-- Atomic "make this my default" (the partial unique index would reject two trues mid-way otherwise).
create or replace function public.set_default_persona(p_persona_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.user_personas set is_default = false
   where user_id = auth.uid() and is_default and id <> p_persona_id;
  update public.user_personas set is_default = true
   where id = p_persona_id and user_id = auth.uid();
  if not found then
    raise exception 'persona % not found or not yours', p_persona_id;
  end if;
end $$;
grant execute on function public.set_default_persona(uuid) to authenticated;

create table if not exists public.persona_bindings (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id bigint not null references public.characters(id) on delete cascade,
  persona_id uuid not null references public.user_personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
create index if not exists persona_bindings_persona_idx on public.persona_bindings(persona_id);

alter table public.persona_bindings enable row level security;
drop policy if exists "persona_bindings_owner_all" on public.persona_bindings;
create policy "persona_bindings_owner_all" on public.persona_bindings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

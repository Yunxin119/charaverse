-- =====================================================================
-- CharaVerse v2 · Phase 5: memory system fixes
-- Run in the Supabase SQL editor (idempotent).
--   1. column types: chat_memories.session_id text → uuid (+ FK), int → bigint ids
--   2. delete_summary_with_rollback(): soft-delete a summary and roll its memories
--      back to the previous version in ONE transaction (was a client-side loop)
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------
do $$
begin
  -- chat_memories.session_id: text → uuid
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'chat_memories'
               and column_name = 'session_id' and data_type = 'text') then
    -- drop rows that cannot be cast (orphans from very old versions)
    delete from public.chat_memories where session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    alter table public.chat_memories alter column session_id type uuid using session_id::uuid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chat_memories_session_fk') then
    delete from public.chat_memories m where not exists (select 1 from public.chat_sessions s where s.id = m.session_id);
    alter table public.chat_memories
      add constraint chat_memories_session_fk foreign key (session_id) references public.chat_sessions(id) on delete cascade;
  end if;
end $$;

-- integer → bigint on id-ish columns (keeps FKs valid: targets are bigint)
do $$
declare r record;
begin
  for r in
    select table_name, column_name from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'chat_memories' and column_name in ('summary_id','start_message_id','end_message_id'))
         or (table_name = 'chat_memory_versions' and column_name in ('summary_id','created_by_summary_id','start_message_id','end_message_id'))
         or (table_name = 'chat_summaries' and column_name in ('start_message_id','end_message_id')))
       and data_type = 'integer'
  loop
    execute format('alter table public.%I alter column %I type bigint', r.table_name, r.column_name);
  end loop;
end $$;

create index if not exists chat_memories_session_enabled_idx on public.chat_memories(session_id, is_enabled, importance desc);
create index if not exists chat_memories_summary_idx on public.chat_memories(summary_id);
create index if not exists chat_memory_versions_memory_idx on public.chat_memory_versions(memory_id, version);

-- ---------------------------------------------------------------
-- 2. Soft-delete a summary + roll back the memories it touched
--    Returns { reverted, disabled }.
-- ---------------------------------------------------------------
create or replace function public.delete_summary_with_rollback(p_summary_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  m record;
  prev record;
  v_reverted int := 0;
  v_disabled int := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from chat_summaries s where s.id = p_summary_id and s.user_id = v_uid) then
    raise exception 'summary % not found', p_summary_id;
  end if;

  for m in select id, current_version from chat_memories where summary_id = p_summary_id and user_id = v_uid loop
    if coalesce(m.current_version, 1) > 1 then
      select * into prev from chat_memory_versions
       where memory_id = m.id and version = m.current_version - 1
       limit 1;
      if found then
        update chat_memories
           set title = prev.title, content = prev.content, importance = prev.importance,
               metadata = prev.metadata, summary_id = prev.summary_id,
               current_version = m.current_version - 1,
               start_message_id = prev.start_message_id, end_message_id = prev.end_message_id,
               updated_at = now()
         where id = m.id and user_id = v_uid;
        delete from chat_memory_versions where memory_id = m.id and version = m.current_version;
        v_reverted := v_reverted + 1;
      else
        update chat_memories set is_enabled = false, updated_at = now() where id = m.id and user_id = v_uid;
        v_disabled := v_disabled + 1;
      end if;
    else
      update chat_memories set is_enabled = false, updated_at = now() where id = m.id and user_id = v_uid;
      v_disabled := v_disabled + 1;
    end if;
  end loop;

  update chat_summaries set is_active = false, invalidated_at = now() where id = p_summary_id and user_id = v_uid;
  return jsonb_build_object('reverted', v_reverted, 'disabled', v_disabled);
end $$;
grant execute on function public.delete_summary_with_rollback(bigint) to authenticated;

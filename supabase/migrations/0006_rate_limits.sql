-- =====================================================================
-- CharaVerse v2 · Phase 6: per-user rate limiting for the LLM proxy routes
-- Run in the Supabase SQL editor (idempotent).
-- consume_rate_limit('chat', 30, 60) → true if the caller may proceed.
-- Fixed windows; one row per (user, bucket, window). Old rows are pruned opportunistically.
-- =====================================================================
create table if not exists public.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- no direct access; only the function below (security definer) touches it
drop policy if exists "rate_limits_none" on public.rate_limits;

create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'unauthenticated');
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (user_id, bucket, window_start, count)
  values (v_uid, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  -- prune ~1% of the time
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'reset_at', v_window + make_interval(secs => p_window_seconds)
  );
end $$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

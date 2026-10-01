-- ============================================================================
-- Phase 8 concurrency fix (found by scripts/test-concurrency.sh): ai_take_quota
-- checked the limits and then logged the request, so 20 simultaneous requests
-- from one person all passed the per-minute check (8 got through instead of 6).
-- A per-user advisory lock now serializes one person's requests. Grants are
-- unchanged (CREATE OR REPLACE keeps them).
-- ============================================================================
create or replace function public.ai_take_quota(p_assistant text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_day integer := public.setting_int('ai.requests_per_day', 30);
  v_min integer := public.setting_int('ai.requests_per_minute', 6);
  v_used integer; v_ok boolean;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  -- Serialize one person's requests so parallel calls can't all pass the limit check before any is logged.
  perform pg_advisory_xact_lock(hashtextextended('ai_quota:' || v_uid::text, 0));
  if public.setting_int('ai.enabled', 0) <> 1 then
    raise exception 'The AI assistants are switched off right now' using errcode = 'check_violation';
  end if;
  v_ok := case p_assistant
    when 'buyer' then public.has_role('buyer')
    when 'seller' then public.has_role('seller')
    when 'freight' then public.has_role('buyer') or public.has_role('seller')
    when 'admin' then public.is_admin()
    when 'dispute_summary' then public.is_admin()
    else false end;
  if not coalesce(v_ok, false) then raise exception 'That assistant is not available to your account' using errcode = 'insufficient_privilege'; end if;

  if (select count(*) from public.ai_usage where user_id = v_uid and created_at > now() - interval '1 minute') >= v_min then
    raise exception 'Slow down a little — try again in a minute' using errcode = 'check_violation';
  end if;
  select count(*) into v_used from public.ai_usage where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_used >= v_day then raise exception 'You''ve reached today''s assistant limit (%). It resets on a rolling 24 hours.', v_day using errcode = 'check_violation'; end if;

  insert into public.ai_usage (user_id, assistant) values (v_uid, p_assistant);
  return v_day - v_used - 1;
end $$;

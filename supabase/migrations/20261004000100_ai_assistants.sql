-- ============================================================================
-- Phase 7 — AI assistants (advisory only)
--
-- The AI layer never writes business data. This migration gives it only:
--   * settings (off by default) and a per-user quota,
--   * an append-only usage log (who, which assistant, when — never the prompt),
--   * one aggregate, PII-free snapshot for the admin briefing.
-- Nothing here can approve a payment, release escrow, refund, verify anyone or
-- touch the ledger or audit log.
-- ============================================================================

insert into public.platform_settings (key, value, description, is_sensitive, min_value, max_value) values
  ('ai.enabled', '0', 'Master switch for the AI assistants (1 = on, 0 = off). They also need a provider key on the server.', false, 0, 1),
  ('ai.requests_per_day', '30', 'Assistant requests one person may make in 24 hours.', false, 1, 1000),
  ('ai.requests_per_minute', '6', 'Assistant requests one person may make in a minute.', false, 1, 60),
  ('ai.max_input_chars', '6000', 'Longest text (characters) a person may send to an assistant in one request.', false, 500, 20000)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Usage log: metadata only, append-only.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  assistant  text not null check (assistant in ('buyer', 'seller', 'freight', 'admin', 'dispute_summary')),
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create trigger ai_usage_append_only before update or delete on public.ai_usage
  for each row execute function public.prevent_mutation();
comment on table public.ai_usage is 'One row per assistant request. Stores who and which assistant only — prompts and answers are never stored.';

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;
grant all on table public.ai_usage to service_role;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Quota gate. Called by the server before every assistant request.
-- Re-checks who you are: each assistant is only for the roles it serves.
-- ---------------------------------------------------------------------------
create or replace function public.ai_take_quota(p_assistant text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_day integer := public.setting_int('ai.requests_per_day', 30);
  v_min integer := public.setting_int('ai.requests_per_minute', 6);
  v_used integer; v_ok boolean;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
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

-- ---------------------------------------------------------------------------
-- Admin briefing input: aggregates only. No names of buyers, phones, amounts
-- per person, codes or documents — so there is nothing private to leak into a
-- prompt. Sellers and carriers appear only as counts.
-- ---------------------------------------------------------------------------
create or replace function public.admin_marketplace_snapshot(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 180));
  v_since timestamptz;
  v_out jsonb;
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  v_since := now() - make_interval(days => v_days);
  select jsonb_build_object(
    'window_days', v_days,
    'orders_by_status', coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*) n from public.orders where placed_at >= v_since group by 1) s), '{}'::jsonb),
    'completed_value_minor', coalesce((select jsonb_object_agg(currency, v) from (select currency::text, sum(total_minor) v from public.orders where status = 'completed' and placed_at >= v_since group by 1) s), '{}'::jsonb),
    'payments_by_status', coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*) n from public.payment_transactions where created_at >= v_since group by 1) s), '{}'::jsonb),
    'disputes_by_kind', coalesce((select jsonb_object_agg(kind, n) from (select kind::text, count(*) n from public.disputes where created_at >= v_since group by 1) s), '{}'::jsonb),
    'disputes_by_status', coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*) n from public.disputes where created_at >= v_since group by 1) s), '{}'::jsonb),
    'live_disputes', (select count(*) from public.disputes where status in ('open', 'under_review')),
    'oldest_live_dispute_days', (select coalesce(extract(day from now() - min(created_at))::int, 0) from public.disputes where status in ('open', 'under_review')),
    'orders_awaiting_seller_over_24h', (select count(*) from public.orders where status = 'pending_seller' and placed_at < now() - interval '24 hours'),
    'orders_in_transit', (select count(*) from public.orders where status in ('in_transit', 'awaiting_confirmation')),
    'carriers_awaiting_verification', (select count(*) from public.carrier_profiles where verification_status in ('pending', 'under_review')),
    'businesses_awaiting_verification', (select count(*) from public.businesses where verification_status = 'pending'),
    'sellers_with_3plus_cancellations', (select count(*) from public.trust_stats where subject_kind = 'seller' and cancelled_by_subject >= 3),
    'sellers_with_upheld_disputes', (select count(*) from public.trust_stats where subject_kind = 'seller' and disputes_upheld >= 1),
    'carriers_with_upheld_disputes', (select count(*) from public.trust_stats where subject_kind = 'carrier' and disputes_upheld >= 1),
    'escrow_held_minor', coalesce((select jsonb_object_agg(currency, v) from (select currency::text, sum(amount_minor) v from public.escrow_accounts where status = 'held' group by 1) s), '{}'::jsonb),
    'payouts_pending', (select count(*) from public.payouts where status in ('pending', 'initiated'))
  ) into v_out;
  return v_out;
end $$;

revoke execute on function public.ai_take_quota(text), public.admin_marketplace_snapshot(integer) from public, anon;
grant execute on function public.ai_take_quota(text), public.admin_marketplace_snapshot(integer) to authenticated;

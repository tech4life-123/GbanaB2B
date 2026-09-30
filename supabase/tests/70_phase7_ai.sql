-- ============================================================================
-- Phase 7 AI assistants: switched off by default, role-gated, rate-limited,
-- usage log append-only and private, admin snapshot is aggregate-only.
-- ============================================================================
\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then raise notice 'PASS  %  (blocked: %)', p_label, sqlerrm; return; end;
  raise exception 'FAIL  % — statement succeeded but should have been blocked', p_label;
end $$;
create or replace function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL  %', p_label; end if;
  raise notice 'PASS  %', p_label;
end $$;
grant execute on function pg_temp.as_user(uuid), pg_temp.expect_error(text, text), pg_temp.check(boolean, text) to public;

-- Bea buyer · Sam seller · Cal carrier · Ada admin · Bo buyer+seller
insert into auth.users (id, phone) values
  ('70000000-0000-0000-0000-00000000000b', '231770700001'), ('70000000-0000-0000-0000-00000000000a', '231770700002'),
  ('70000000-0000-0000-0000-00000000000c', '231770700003'), ('70000000-0000-0000-0000-000000000009', '231770700004'),
  ('70000000-0000-0000-0000-0000000000b0', '231770700005');
insert into public.user_roles (user_id, role) values
  ('70000000-0000-0000-0000-00000000000b', 'buyer'), ('70000000-0000-0000-0000-00000000000a', 'seller'),
  ('70000000-0000-0000-0000-00000000000c', 'carrier'), ('70000000-0000-0000-0000-000000000009', 'admin'),
  ('70000000-0000-0000-0000-0000000000b0', 'buyer'), ('70000000-0000-0000-0000-0000000000b0', 'seller');

-- ---------- off by default --------------------------------------------------------------------------
select pg_temp.check((select value #>> '{}' = '0' from public.platform_settings where key = 'ai.enabled'), 'the assistants are off by default');
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'a buyer cannot use an assistant while it is switched off');
commit;
begin;
set local role anon;
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'anon cannot call the quota gate');
select pg_temp.expect_error($q$select public.admin_marketplace_snapshot(30)$q$, 'anon cannot read the admin snapshot');
commit;

-- Admin switches them on through the audited settings function.
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.update_platform_setting('ai.enabled', '1'::jsonb)$q$, 'a buyer cannot switch the assistants on');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select public.update_platform_setting('ai.enabled', '1'::jsonb);
commit;
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'platform_setting.updated' and entity_id = 'ai.enabled'), 'switching them on is audited');

-- ---------- who may use which assistant ---------------------------------------------------------------
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.ai_take_quota('buyer') = 29, 'a buyer can use the buyer assistant (29 left today)');
select public.ai_take_quota('freight');
select pg_temp.expect_error($q$select public.ai_take_quota('seller')$q$, 'a buyer cannot use the seller assistant');
select pg_temp.expect_error($q$select public.ai_take_quota('admin')$q$, 'a buyer cannot use the admin assistant');
select pg_temp.expect_error($q$select public.ai_take_quota('dispute_summary')$q$, 'a buyer cannot summarise disputes');
select pg_temp.expect_error($q$select public.ai_take_quota('made_up')$q$, 'an unknown assistant is refused');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000a');
select public.ai_take_quota('seller');
select public.ai_take_quota('freight');
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'a seller cannot use the buyer assistant');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$select public.ai_take_quota('freight')$q$, 'a carrier has no assistant');
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'a carrier cannot borrow the buyer assistant');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select public.ai_take_quota('admin');
select public.ai_take_quota('dispute_summary');
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'an admin is not automatically a buyer');
commit;

-- ---------- rate limits ---------------------------------------------------------------------------------------
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select public.update_platform_setting('ai.requests_per_minute', '2'::jsonb);
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-0000000000b0');
select public.ai_take_quota('buyer');
select public.ai_take_quota('seller');
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'a third request inside a minute is refused');
commit;
-- Move this person's history back so only the daily limit matters.
alter table public.ai_usage disable trigger ai_usage_append_only;
update public.ai_usage set created_at = now() - interval '2 hours' where user_id = '70000000-0000-0000-0000-0000000000b0';
alter table public.ai_usage enable trigger ai_usage_append_only;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select public.update_platform_setting('ai.requests_per_day', '2'::jsonb);
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-0000000000b0');
select pg_temp.expect_error($q$select public.ai_take_quota('buyer')$q$, 'the daily limit applies across assistants');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select public.update_platform_setting('ai.requests_per_day', '30'::jsonb);
select public.update_platform_setting('ai.requests_per_minute', '6'::jsonb);
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-0000000000b0');
select pg_temp.check(public.ai_take_quota('buyer') >= 0, 'raising the limit lets them continue');
commit;

-- ---------- the usage log ----------------------------------------------------------------------------------------
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 2 and bool_and(user_id = auth.uid()) from public.ai_usage), 'a person sees only their own usage');
select pg_temp.expect_error($q$insert into public.ai_usage (user_id, assistant) values (auth.uid(), 'buyer')$q$, 'usage cannot be written directly (no quota bypass)');
select pg_temp.expect_error($q$delete from public.ai_usage$q$, 'usage cannot be deleted');
select pg_temp.expect_error($q$update public.ai_usage set assistant = 'admin'$q$, 'usage cannot be edited');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 2 from public.ai_usage), 'the seller sees their two rows, not the buyer''s');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) >= 8 from public.ai_usage), 'an admin sees everyone''s usage');
commit;
begin;
set local role anon;
select pg_temp.expect_error($q$select count(*) from public.ai_usage$q$, 'anon cannot read usage');
commit;
select pg_temp.check(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_usage' and column_name in ('prompt', 'response', 'content', 'body')), 'prompts and answers are never stored');

-- ---------- admin snapshot --------------------------------------------------------------------------------------------
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.admin_marketplace_snapshot(30)$q$, 'a buyer cannot read the admin snapshot');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($q$select public.admin_marketplace_snapshot(30)$q$, 'a seller cannot read the admin snapshot');
commit;
begin;
select pg_temp.as_user('70000000-0000-0000-0000-000000000009');
select pg_temp.check((public.admin_marketplace_snapshot(30)) ? 'live_disputes' and (public.admin_marketplace_snapshot(30)) ? 'orders_by_status', 'an admin gets the snapshot');
select pg_temp.check((public.admin_marketplace_snapshot(9999) ->> 'window_days')::int = 180, 'the window is clamped to 180 days');
select pg_temp.check((public.admin_marketplace_snapshot(null) ->> 'window_days')::int = 30, 'the window defaults to 30 days');
select pg_temp.check(public.admin_marketplace_snapshot(30)::text !~* '(phone|msisdn|code|email|@)', 'the snapshot carries no personal fields');
commit;

-- ---------- structural guarantee ------------------------------------------------------------------------------------------
select pg_temp.check((select count(*) = 4 from public.platform_settings where key like 'ai.%'), 'the AI limits are configurable settings');
select pg_temp.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'ai\_%' and p.proname not in ('ai_take_quota')), 'the AI layer adds exactly one callable database function (the quota gate)');

\echo ALL PHASE 7 AI TESTS PASSED

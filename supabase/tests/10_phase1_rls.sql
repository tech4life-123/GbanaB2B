-- ============================================================================
-- Phase 1 RLS & workflow tests. Run with `npm run test:db`.
-- Each check raises on failure; the script stops at the first error
-- (ON_ERROR_STOP). Scenarios use realistic role switching: `set local role
-- authenticated` + a JWT `sub` claim, exactly as PostgREST does.
-- ============================================================================
\set ON_ERROR_STOP on

-- ---------- fixtures (run as owner) ----------------------------------------
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '231770000001'),  -- Alice: buyer
  ('00000000-0000-0000-0000-00000000000b', '231880000002'),  -- Bola: seller
  ('00000000-0000-0000-0000-00000000000c', '231550000003'),  -- Cyrus: admin
  ('00000000-0000-0000-0000-00000000000d', '231770000004');  -- Dee: will be suspended

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS  %  (blocked: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAIL  % — statement succeeded but should have been blocked', p_label;
end $$;

create or replace function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL  %', p_label; end if;
  raise notice 'PASS  %', p_label;
end $$;

-- The migrations revoke EXECUTE-by-default, so test helpers opt back in.
grant execute on function pg_temp.as_user(uuid), pg_temp.expect_error(text, text), pg_temp.check(boolean, text) to public;

-- 1. Trigger created profiles with E.164 phones
select pg_temp.check((select count(*) = 4 from public.profiles), 'profiles auto-created from auth.users');
select pg_temp.check((select phone = '+231770000001' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'phone mirrored in E.164');

-- 2. Bootstrap admin (owner/service context only)
select public.bootstrap_admin('+231550000003');
select pg_temp.check(exists(select 1 from public.user_roles where user_id = '00000000-0000-0000-0000-00000000000c' and role = 'admin'), 'bootstrap_admin grants admin');

-- ---------- Alice (buyer) ----------------------------------------------------
begin;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.complete_onboarding('Alice Kollie', 'buyer');
select pg_temp.check((select count(*) = 1 from public.profiles), 'Alice sees only her own profile');
select pg_temp.check((select full_name = 'Alice Kollie' and default_role = 'buyer' and onboarded_at is not null from public.profiles), 'onboarding sets name, default role, timestamp');
select pg_temp.check((select array_agg(role::text) = array['buyer'] from public.user_roles), 'Alice holds exactly buyer');
select public.request_role('buyer'); -- idempotent
select pg_temp.check((select count(*) = 1 from public.user_roles), 'request_role is idempotent');
select pg_temp.expect_error($q$select public.request_role('admin')$q$, 'cannot self-assign admin');
select pg_temp.expect_error($q$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin')$q$, 'cannot insert user_roles directly');
select pg_temp.expect_error($q$update public.user_roles set status = 'active'$q$, 'cannot update user_roles directly');
select pg_temp.expect_error($q$update public.profiles set status = 'active' where id = auth.uid()$q$, 'cannot change own account status');
select pg_temp.expect_error($q$update public.profiles set default_role = 'admin' where id = auth.uid()$q$, 'cannot set default_role column directly');
select pg_temp.expect_error($q$update public.profiles set phone = '+231770009999' where id = auth.uid()$q$, 'cannot change phone via profiles');
select pg_temp.expect_error($q$select public.set_default_role('seller')$q$, 'cannot default to a role not held');
select pg_temp.expect_error($q$select public.grant_role(auth.uid(), 'admin')$q$, 'non-admin cannot grant roles');
select pg_temp.expect_error($q$select public.update_platform_setting('commerce.platform_fee_bps', '0')$q$, 'non-admin cannot change settings');
select pg_temp.expect_error($q$select public.bootstrap_admin('+231770000001')$q$, 'clients cannot call bootstrap_admin');
select pg_temp.expect_error($q$select public.write_audit_log('x.y', 'z', null, '{}')$q$, 'clients cannot call write_audit_log');
update public.profiles set display_name = 'Alice K.' where id = auth.uid();
select pg_temp.check((select display_name = 'Alice K.' from public.profiles), 'Alice can edit permitted columns');
update public.profiles set display_name = 'hijack' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) = 0 from public.audit_logs), 'Alice cannot read audit logs');
select pg_temp.check((select count(*) = 0 from public.platform_settings where is_sensitive), 'no sensitive settings visible');
select pg_temp.check((select count(*) > 0 from public.platform_settings), 'non-sensitive settings readable');
commit;
select pg_temp.check((select display_name is null from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'Alice could not modify Bola''s profile');

-- ---------- anonymous ----------------------------------------------------------
begin;
set local role anon;
select pg_temp.expect_error($q$select count(*) from public.profiles$q$, 'anon cannot read profiles');
select pg_temp.expect_error($q$select count(*) from public.platform_settings$q$, 'anon cannot read settings');
select pg_temp.expect_error($q$select public.request_role('buyer')$q$, 'anon cannot request roles');
commit;

-- ---------- Bola (seller) -----------------------------------------------------
begin;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.complete_onboarding('Bola Wholesale', 'seller');
select public.request_role('buyer');
select public.set_default_role('buyer');
select pg_temp.check((select default_role = 'buyer' from public.profiles), 'set_default_role for a held role');
select pg_temp.check((select count(*) = 2 from public.user_roles), 'Bola holds seller + buyer');
select pg_temp.check((select count(*) = 0 from public.user_roles where user_id <> auth.uid()), 'Bola cannot see other users'' roles');
commit;

-- ---------- Cyrus (admin) -----------------------------------------------------
begin;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 4 from public.profiles), 'admin sees all profiles');
select pg_temp.check((select count(*) = 4 from public.user_roles), 'admin sees all roles (Alice 1, Bola 2, Cyrus 1)');
select public.update_platform_setting('commerce.platform_fee_bps', '300');
select pg_temp.check((select value = '300'::jsonb from public.platform_settings where key = 'commerce.platform_fee_bps'), 'admin updates fee');
select pg_temp.expect_error($q$select public.update_platform_setting('commerce.platform_fee_bps', '"3%"')$q$, 'setting type cannot change');
select pg_temp.expect_error($q$select public.update_platform_setting('commerce.platform_fee_bps', '50000')$q$, 'setting bounds enforced');
select pg_temp.expect_error($q$select public.update_platform_setting('made.up_key', '1')$q$, 'unknown settings cannot be created');
select public.revoke_role('00000000-0000-0000-0000-00000000000b', 'seller');
select pg_temp.expect_error($q$select public.revoke_role(auth.uid(), 'admin')$q$, 'admin cannot revoke own admin');
select pg_temp.check((select count(*) >= 5 from public.audit_logs), 'admin reads audit trail');
select pg_temp.check(exists(select 1 from public.audit_logs where action = 'platform_setting.updated' and metadata->>'old' = '250' and metadata->>'new' = '300'), 'setting change audited with old/new');
select pg_temp.expect_error($q$update public.audit_logs set action = 'tampered.x'$q$, 'audit logs cannot be updated');
select pg_temp.expect_error($q$delete from public.audit_logs$q$, 'audit logs cannot be deleted');
commit;

-- Revoked role cannot be self-reinstated
begin;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.request_role('seller')$q$, 'revoked role cannot be self-reinstated');
select pg_temp.check((select not public.has_role('seller')), 'has_role false after revoke');
commit;

-- ---------- suspension ----------------------------------------------------------
select public.bootstrap_admin('+231770000004');           -- make Dee an admin…
update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000d'; -- …then suspend
begin;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select not public.is_admin()), 'suspended admin loses admin powers');
select pg_temp.check((select count(*) = 0 from public.audit_logs), 'suspended admin cannot read audit logs');
select pg_temp.expect_error($q$select public.request_role('buyer')$q$, 'suspended user cannot request roles');
commit;

-- Even the service role cannot rewrite history
begin;
set local role service_role;
select pg_temp.expect_error($q$delete from public.audit_logs$q$, 'service_role cannot delete audit logs');
select pg_temp.expect_error($q$truncate public.audit_logs$q$, 'service_role cannot truncate audit logs');
commit;

-- …and neither can the table owner: the append-only trigger fires for everyone.
select pg_temp.expect_error($q$delete from public.audit_logs$q$, 'owner cannot delete audit logs (trigger)');
select pg_temp.expect_error($q$update public.audit_logs set metadata = '{}'$q$, 'owner cannot update audit logs (trigger)');

\echo 'ALL PHASE 1 DATABASE TESTS PASSED'

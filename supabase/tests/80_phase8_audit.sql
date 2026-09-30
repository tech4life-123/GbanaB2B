-- ============================================================================
-- Phase 8 audit: structural security invariants + privacy hardening.
-- The same structural queries were run against the live project.
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

-- ---------- structural invariants ---------------------------------------------------------------------
select pg_temp.check(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'every public table has row level security on');
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  'every SECURITY DEFINER function pins search_path');
select pg_temp.check(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 'anon can execute no public function');
select pg_temp.check(not exists (select 1 from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'PUBLIC') and privilege_type <> 'SELECT'), 'anon has read-only access at most');
select pg_temp.check((select array_agg(table_name::text order by table_name::text) from (select distinct table_name from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon' and privilege_type = 'SELECT') t)
  = array['product_categories','product_images','product_listings','product_price_tiers','product_specifications','trust_stats'],
  'anon reads whole rows of public catalogue tables only (businesses and products are column-granted)');
select pg_temp.check(not exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) ~ 'auth\.uid\(\)'
    and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) !~ 'SELECT auth\.uid\(\)'),
  'policies call auth.uid() through a subselect (evaluated once per query)');
select pg_temp.check(not exists (
  select 1 from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and con.contype = 'f'
    and not exists (select 1 from pg_index i where i.indrelid = con.conrelid and (i.indkey::int2[])[0:array_length(con.conkey,1)-1] = con.conkey)),
  'every foreign key has a covering index');

-- ---------- privacy: businesses --------------------------------------------------------------------------
insert into auth.users (id, phone) values
  ('80000000-0000-0000-0000-00000000000a', '231770800001'), ('80000000-0000-0000-0000-00000000000b', '231770800002'),
  ('80000000-0000-0000-0000-000000000009', '231770800003');
insert into public.user_roles (user_id, role) values
  ('80000000-0000-0000-0000-00000000000a', 'seller'), ('80000000-0000-0000-0000-00000000000b', 'buyer'), ('80000000-0000-0000-0000-000000000009', 'admin');

begin;
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select public.create_business('Audit Traders', 'wholesaler', 'Montserrado', 'Monrovia', 'desc', '+231770800001');
commit;
update public.businesses set status = 'active', registration_number = 'REG-777', address_line = '12 Secret Street' where trading_name = 'Audit Traders';
begin;
select pg_temp.as_user('80000000-0000-0000-0000-000000000009');
select public.admin_review_business((select id from public.businesses where trading_name = 'Audit Traders'), 'rejected', 'active', 'TIN did not match the certificate');
commit;

begin;
set local role anon;
select pg_temp.check((select count(*) from public.businesses where trading_name = 'Audit Traders') = 1, 'the public can see an active business');
select pg_temp.expect_error($q$select verification_note from public.businesses$q$, 'the public cannot read the internal verification note');
select pg_temp.expect_error($q$select registration_number from public.businesses$q$, 'the public cannot read the registration number');
select pg_temp.expect_error($q$select address_line from public.businesses$q$, 'the public cannot read the street address');
select pg_temp.expect_error($q$select contact_phone from public.businesses$q$, 'the public cannot read the phone number');
select pg_temp.expect_error($q$select created_by from public.businesses$q$, 'the public cannot read the owner''s user id');
select pg_temp.expect_error($q$select * from public.businesses$q$, 'select * on businesses is refused for the public');
select pg_temp.expect_error($q$select created_by from public.products$q$, 'the public cannot read a product''s creator');
select pg_temp.check((select count(*) from public.product_listings) >= 0, 'the public listing view still works');
commit;

begin;
select pg_temp.as_user('80000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select verification_note from public.businesses$q$, 'another signed-in user cannot read the internal note');
select pg_temp.check((select registration_number from public.businesses where trading_name = 'Audit Traders') = 'REG-777', 'signed-in users still read the ordinary profile');
select pg_temp.check(public.business_verification_note((select id from public.businesses where trading_name = 'Audit Traders')) is null, 'the note function returns nothing to a non-member');
commit;

begin;
select pg_temp.as_user('80000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.admin_business_notes()) = 0, 'a non-admin gets no notes from the admin function');
commit;

begin;
select pg_temp.as_user('80000000-0000-0000-0000-00000000000a');
select pg_temp.check(public.business_verification_note((select id from public.businesses where trading_name = 'Audit Traders')) = 'TIN did not match the certificate', 'the owner can read the team''s note to them');
commit;

begin;
select pg_temp.as_user('80000000-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) from public.admin_business_notes() where note like 'TIN%') = 1, 'an admin can list the notes');
commit;

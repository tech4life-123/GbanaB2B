-- ============================================================================
-- Phase 2 marketplace: RLS, workflows and integrity. Run with `npm run test:db`.
-- Independent of the Phase 1 fixtures (own users).
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

-- ---------- fixtures -----------------------------------------------------------
insert into auth.users (id, phone) values
  ('10000000-0000-0000-0000-00000000000a', '231770100001'),  -- Sam: seller
  ('10000000-0000-0000-0000-00000000000b', '231770100002'),  -- Tia: seller (competitor)
  ('10000000-0000-0000-0000-00000000000c', '231770100003'),  -- Uma: buyer
  ('10000000-0000-0000-0000-00000000000d', '231770100004');  -- Vic: admin
insert into public.user_roles (user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', 'seller'),
  ('10000000-0000-0000-0000-00000000000b', 'seller'),
  ('10000000-0000-0000-0000-00000000000c', 'buyer'),
  ('10000000-0000-0000-0000-00000000000d', 'admin');

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

-- ---------- Uma (buyer only) cannot create a business --------------------------
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$select public.create_business('Uma Shop', 'retailer', 'Montserrado', 'Paynesville')$q$, 'buyer without seller role cannot create a business');
commit;

-- ---------- Sam creates a business and a listing ---------------------------------
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
insert into ids select 'sam_biz', public.create_business('Sam Wholesale & Sons', 'wholesaler', 'Montserrado', 'Waterside', 'Rice and oil importer', '+231770100001');
select pg_temp.check((select slug ~ '^sam-wholesale-sons-[0-9a-f]{6}$' from public.businesses where id = (select v from ids where k = 'sam_biz')), 'business slug generated');
select pg_temp.check((select member_role = 'owner' from public.business_members where business_id = (select v from ids where k = 'sam_biz')), 'creator becomes owner');
select pg_temp.expect_error($q$select public.create_business('Second', 'wholesaler', 'Bong', 'Gbarnga')$q$, 'one owned business per person');
select pg_temp.expect_error($q$select public.create_business('Bad County', 'wholesaler', 'Atlantis', 'Nowhere')$q$, 'county must be a Liberian county');
select pg_temp.expect_error($q$update public.businesses set verification_status = 'verified'$q$, 'owner cannot self-verify');
select pg_temp.expect_error($q$update public.businesses set slug = 'hijack'$q$, 'owner cannot change slug');
update public.businesses set description = 'Rice, oil and flour by the bag' where id = (select v from ids where k = 'sam_biz');
select pg_temp.check((select description = 'Rice, oil and flour by the bag' from public.businesses where id = (select v from ids where k = 'sam_biz')), 'owner can edit profile fields');

insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, description)
select (select v from ids where k = 'sam_biz'), (select id from public.product_categories where slug = 'rice-grains'),
       'Parboiled long-grain rice', '25 kg bag', 'bag', 10, 500, 'Premium parboiled rice from Thailand';
insert into ids select 'rice', id from public.products where title = 'Parboiled long-grain rice';
select pg_temp.check((select status = 'draft' and slug like 'parboiled-long-grain-rice-%' and created_by = auth.uid() from public.products where id = (select v from ids where k = 'rice')), 'new listing is a draft with slug and creator');

select pg_temp.expect_error($q$update public.products set status = 'active' where id = (select v from ids where k = 'rice')$q$, 'cannot publish without weight/tiers');
update public.products set unit_weight_g = 25300 where id = (select v from ids where k = 'rice');
select pg_temp.expect_error($q$update public.products set status = 'active' where id = (select v from ids where k = 'rice')$q$, 'cannot publish without price tiers');
select pg_temp.expect_error($q$update public.products set moq = 1 where id = (select v from ids where k = 'rice')$q$, 'MOQ only changes via save_product_pricing');

select pg_temp.expect_error($q$select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":5,"max_qty":49,"unit_price_minor":2450},{"min_qty":50,"max_qty":null,"unit_price_minor":2300}]')$q$, 'first tier must start at MOQ');
select pg_temp.expect_error($q$select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":49,"unit_price_minor":2450},{"min_qty":60,"max_qty":null,"unit_price_minor":2300}]')$q$, 'tiers must be contiguous');
select pg_temp.expect_error($q$select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":49,"unit_price_minor":2450},{"min_qty":50,"max_qty":99,"unit_price_minor":2300}]')$q$, 'last tier must be open-ended');
select pg_temp.expect_error($q$select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":0}]')$q$, 'price must be above zero');
select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD',
  '[{"min_qty":10,"max_qty":49,"unit_price_minor":2450},{"min_qty":50,"max_qty":99,"unit_price_minor":2300},{"min_qty":100,"max_qty":null,"unit_price_minor":2150}]');
select pg_temp.check((select count(*) = 3 from public.product_price_tiers where product_id = (select v from ids where k = 'rice')), 'three tiers saved');
select public.save_product_specifications((select v from ids where k = 'rice'), '[{"label":"Grain","value":"Long"},{"label":"Broken","value":"5%"},{"label":"","value":"skipped"}]');
select pg_temp.check((select count(*) = 2 from public.product_specifications where product_id = (select v from ids where k = 'rice')), 'specs saved, blanks skipped');

update public.products set status = 'active' where id = (select v from ids where k = 'rice');
select pg_temp.check((select status = 'active' and published_at is not null from public.products where id = (select v from ids where k = 'rice')), 'listing published');
select pg_temp.expect_error($q$select public.save_product_pricing((select v from ids where k = 'rice'), 20, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":2450}]')$q$, 'active listing: tiers must match new MOQ');

-- images
select pg_temp.expect_error(format($q$insert into public.product_images (product_id, storage_path) values (%L, %L)$q$,
  (select v from ids where k = 'rice'), '00000000-0000-0000-0000-000000000000/' || (select v from ids where k = 'rice') || '/a.webp'), 'image path must match business/product');
insert into public.product_images (product_id, storage_path, sort_order)
select (select v from ids where k = 'rice'), (select v from ids where k = 'sam_biz') || '/' || (select v from ids where k = 'rice') || '/img' || g || '.webp', g
  from generate_series(1, 8) g;
select pg_temp.expect_error(format($q$insert into public.product_images (product_id, storage_path) values (%L, %L)$q$,
  (select v from ids where k = 'rice'), (select v from ids where k = 'sam_biz') || '/' || (select v from ids where k = 'rice') || '/img9.webp'), 'max 8 photos per listing');

-- storage
insert into storage.objects (bucket_id, name) values ('product-images', (select v from ids where k = 'sam_biz') || '/' || (select v from ids where k = 'rice') || '/img1.webp');
select pg_temp.check(true, 'owner can upload into own business folder');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('product-images', 'not-a-uuid/x.webp')$q$, 'upload path must start with a business id');

-- a draft that stays private
insert into public.products (business_id, category_id, title, unit_label, moq)
select (select v from ids where k = 'sam_biz'), (select id from public.product_categories where slug = 'cooking-oil'), 'Vegetable oil 20L (draft)', '20 L jerrycan', 5;
insert into ids select 'oil', id from public.products where title = 'Vegetable oil 20L (draft)';
delete from public.products where id = (select v from ids where k = 'rice');
select pg_temp.check((select count(*) = 1 from public.products where id = (select v from ids where k = 'rice')), 'active listing cannot be deleted (archive instead)');
commit;

-- ---------- anonymous visitor ---------------------------------------------------
begin;
set local role anon;
select pg_temp.check((select count(*) = 1 from public.products), 'anon sees only the published listing');
select pg_temp.check((select min_price_minor = 2150 and moq_price_minor = 2450 and tier_count = 3 and cover_image_path is not null from public.product_listings), 'listing view: prices, tiers, cover image');
select pg_temp.check((select count(*) = 3 from public.product_price_tiers), 'anon sees tiers of public listing');
select pg_temp.check((select count(*) = 1 from public.product_listings where search_vector @@ websearch_to_tsquery('english', 'rice bags')), 'full-text search finds "rice bags"');
select pg_temp.check((select count(*) = 0 from public.product_listings where search_vector @@ websearch_to_tsquery('english', 'cement')), 'search excludes non-matching');
select pg_temp.check((select count(*) = 1 from public.businesses), 'anon sees active business');
select pg_temp.expect_error($q$select count(*) from public.business_members$q$, 'anon cannot list business members');
select pg_temp.expect_error($q$insert into public.products (business_id, category_id, title, unit_label) values (gen_random_uuid(), gen_random_uuid(), 'x', 'y')$q$, 'anon cannot create listings');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('product-images', 'a/b.webp')$q$, 'anon cannot upload');
commit;

-- ---------- Tia (competing seller) ----------------------------------------------
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
insert into ids select 'tia_biz', public.create_business('Tia Traders', 'importer', 'Nimba', 'Ganta');
select pg_temp.check((select count(*) = 1 from public.products), 'competitor cannot see the other seller''s draft');
update public.products set title = 'HACKED' where id = (select v from ids where k = 'rice');
select pg_temp.check((select title = 'Parboiled long-grain rice' from public.products where id = (select v from ids where k = 'rice')), 'competitor cannot edit another listing');
select pg_temp.expect_error($q$select public.save_product_pricing((select v from ids where k = 'rice'), 1, 'USD', '[{"min_qty":1,"max_qty":null,"unit_price_minor":1}]')$q$, 'competitor cannot reprice another listing');
select pg_temp.expect_error($q$insert into public.products (business_id, category_id, title, unit_label) values ((select v from ids where k = 'sam_biz'), (select id from public.product_categories limit 1), 'Sneaky', 'bag')$q$, 'competitor cannot list under another business');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('product-images', (select v from ids where k = 'sam_biz') || '/x/y.webp')$q$, 'competitor cannot upload into another business folder');
delete from public.product_images where product_id = (select v from ids where k = 'rice');
select pg_temp.check((select count(*) = 8 from public.product_images where product_id = (select v from ids where k = 'rice')), 'competitor cannot delete another seller''s photos');
select pg_temp.check((select count(*) = 0 from public.business_members where business_id = (select v from ids where k = 'sam_biz')), 'competitor cannot see another business''s members');
select pg_temp.expect_error($q$insert into public.product_categories (slug, name) values ('fake', 'Fake')$q$, 'sellers cannot create categories');
select pg_temp.expect_error($q$select public.admin_review_business((select v from ids where k = 'tia_biz'), 'verified', 'active')$q$, 'sellers cannot review businesses');
commit;

-- ---------- Vic (admin) -------------------------------------------------------------
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 2 from public.products), 'admin sees drafts too');
insert into public.product_categories (slug, name) values ('solar-kits', 'Solar kits');
select pg_temp.check(exists(select 1 from public.audit_logs where action = 'category.created' and metadata->>'slug' = 'solar-kits'), 'category creation audited');
update public.product_categories set is_active = false where slug = 'solar-kits';
select pg_temp.expect_error($q$select public.admin_review_business((select v from ids where k = 'tia_biz'), 'rejected', 'active')$q$, 'rejection requires a reason');
select public.admin_review_business((select v from ids where k = 'tia_biz'), 'verified', 'active', 'Registration checked');
select pg_temp.check((select verification_status = 'verified' and verified_at is not null from public.businesses where id = (select v from ids where k = 'tia_biz')), 'admin verifies business');
select public.admin_review_business((select v from ids where k = 'sam_biz'), 'unverified', 'suspended', 'Under investigation');
select pg_temp.check((select status = 'paused' from public.products where id = (select v from ids where k = 'rice')), 'suspending a business pauses its listings');
select pg_temp.check((select count(*) >= 3 from public.audit_logs where action in ('business.created', 'business.reviewed')), 'business lifecycle audited');
commit;

begin;
set local role anon;
select pg_temp.check((select count(*) = 0 from public.product_listings), 'suspended business: nothing public');
select pg_temp.check((select count(*) = 0 from public.product_categories where slug = 'solar-kits'), 'inactive category hidden from public');
commit;

-- Suspended business owner can no longer edit
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
update public.products set status = 'active' where id = (select v from ids where k = 'rice');
select pg_temp.check((select status = 'paused' from public.products where id = (select v from ids where k = 'rice')), 'owner of suspended business cannot republish');
select pg_temp.check(not public.can_edit_business((select v from ids where k = 'sam_biz')), 'suspended business is not editable');
commit;

-- Archived listings stay archived; seller role revocation removes edit rights
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
insert into public.products (business_id, category_id, title, unit_label, moq, unit_weight_g)
select (select v from ids where k = 'tia_biz'), (select id from public.product_categories where slug = 'building-materials'), 'Portland cement 50kg', '50 kg bag', 20, 50200;
select public.save_product_pricing((select id from public.products where title = 'Portland cement 50kg'), 20, 'USD', '[{"min_qty":20,"max_qty":null,"unit_price_minor":1150}]');
update public.products set status = 'active' where title = 'Portland cement 50kg';
update public.products set status = 'archived' where title = 'Portland cement 50kg';
select pg_temp.expect_error($q$update public.products set status = 'active' where title = 'Portland cement 50kg'$q$, 'archived listing cannot be reactivated');
commit;

update public.user_roles set status = 'revoked', revoked_at = now() where user_id = '10000000-0000-0000-0000-00000000000b' and role = 'seller';
begin;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
select pg_temp.check(not public.can_edit_business((select v from ids where k = 'tia_biz')), 'revoking seller role removes edit rights');
commit;

\echo 'ALL PHASE 2 MARKETPLACE TESTS PASSED'

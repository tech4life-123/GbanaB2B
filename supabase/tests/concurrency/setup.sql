-- Fixtures for scripts/test-concurrency.sh. Committed (not temp) so parallel sessions can see them.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
grant execute on function pg_temp.as_user(uuid) to public;

create table public.zz_ids (k text primary key, v uuid);
grant all on public.zz_ids to public;

insert into auth.users (id, phone) values
  ('c0000000-0000-0000-0000-00000000000a', '231770900001'), ('c0000000-0000-0000-0000-00000000000b', '231770900002'),
  ('c0000000-0000-0000-0000-00000000000c', '231770900003'), ('c0000000-0000-0000-0000-000000000009', '231770900009'),
  ('c0000000-0000-0000-0000-0000000000e1', '231770900011'), ('c0000000-0000-0000-0000-0000000000e2', '231770900012'),
  ('c0000000-0000-0000-0000-0000000000e3', '231770900013'), ('c0000000-0000-0000-0000-0000000000e4', '231770900014'),
  ('c0000000-0000-0000-0000-0000000000e5', '231770900015');
insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000a', 'seller'), ('c0000000-0000-0000-0000-00000000000b', 'buyer'),
  ('c0000000-0000-0000-0000-00000000000c', 'carrier'), ('c0000000-0000-0000-0000-000000000009', 'admin'),
  ('c0000000-0000-0000-0000-0000000000e1', 'buyer'), ('c0000000-0000-0000-0000-0000000000e2', 'buyer'),
  ('c0000000-0000-0000-0000-0000000000e3', 'buyer'), ('c0000000-0000-0000-0000-0000000000e4', 'buyer'),
  ('c0000000-0000-0000-0000-0000000000e5', 'buyer');
update public.platform_settings set value = '250' where key = 'commerce.platform_fee_bps';
update public.platform_settings set value = '1' where key = 'ai.enabled';

insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties, verification_status, verified_at)
values ('c0000000-0000-0000-0000-00000000000c', 'Cal Cargo', '+231770900003', 'Duala', 'Montserrado', 'Monrovia', array['Montserrado', 'Bong'], 'verified', now());
insert into public.vehicles (carrier_id, vehicle_type, plate_number, payload_kg, is_verified)
values ('c0000000-0000-0000-0000-00000000000c', 'box_truck', 'CON-501', 8000, true);
update public.vehicles set is_verified = true where plate_number = 'CON-501';

begin;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
insert into public.zz_ids select 'biz', public.create_business('Con Supply', 'wholesaler', 'Montserrado', 'Waterside', null, '+231770900001');
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g, unit_volume_cm3, is_fragile)
select (select v from public.zz_ids where k = 'biz'), (select id from public.product_categories limit 1), t.title, '25 kg bag', 'bag', 10, t.qty, 25000, 30000, false
from (values ('Con rice', 500), ('Con scarce', 10)) as t(title, qty);
insert into public.zz_ids select 'rice', id from public.products where title = 'Con rice';
insert into public.zz_ids select 'scarce', id from public.products where title = 'Con scarce';
select public.save_product_pricing((select v from public.zz_ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":2400}]');
select public.save_product_pricing((select v from public.zz_ids where k = 'scarce'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":2400}]');
update public.products set status = 'active' where title in ('Con rice', 'Con scarce');
commit;

-- Every buyer needs an address; the oversell buyers each put the scarce product in their cart.
do $$
declare u uuid;
begin
  foreach u in array array['c0000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-0000000000e2','c0000000-0000-0000-0000-0000000000e3','c0000000-0000-0000-0000-0000000000e4','c0000000-0000-0000-0000-0000000000e5']::uuid[] loop
    insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town) values (u, 'Store', 'Buyer', '+231770900099', 'Bong', 'Gbarnga');
  end loop;
end $$;

-- Three orders for the main buyer (release race, webhook race, transition race).
begin;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000b');
do $$ declare i integer; oid uuid; begin
  for i in 1..3 loop
    insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from public.zz_ids where k = 'rice'), 10);
    oid := (public.place_orders((select id from public.addresses where profile_id = auth.uid() limit 1)))[1];
    insert into public.zz_ids values ('o' || i, oid);
  end loop;
end $$;
commit;

begin;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
do $$ declare i integer; begin
  for i in 1..2 loop
    perform public.transition_order((select v from public.zz_ids where k = 'o' || i), 'confirmed');
    perform public.transition_order((select v from public.zz_ids where k = 'o' || i), 'fulfilling');
    perform public.transition_order((select v from public.zz_ids where k = 'o' || i), 'ready_for_freight');
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..2 loop insert into public.zz_ids values ('r' || i, public.create_freight_rfq((select v from public.zz_ids where k = 'o' || i), current_date + 1)); end loop;
end $$;
commit;
begin;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ declare i integer; begin
  for i in 1..2 loop insert into public.zz_ids values ('b' || i, public.submit_freight_bid((select v from public.zz_ids where k = 'r' || i), (select id from public.vehicles where plate_number = 'CON-501'), 5000, 10, current_date + 2)); end loop;
end $$;
commit;
begin;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..2 loop perform public.select_freight_bid((select v from public.zz_ids where k = 'b' || i)); end loop;
  insert into public.zz_ids values ('t1', public.start_payment((select v from public.zz_ids where k = 'o1'), 'sandbox', '+231770900002', 'con-pay-o1-0001'));
  insert into public.zz_ids values ('t2', public.start_payment((select v from public.zz_ids where k = 'o2'), 'sandbox', '+231770900002', 'con-pay-o2-0001'));
end $$;
commit;
begin;
set local role service_role;
select public.record_payment_attempt((select v from public.zz_ids where k = 't1'), 'SBX-C1', 'pending');
select public.record_payment_attempt((select v from public.zz_ids where k = 't2'), 'SBX-C2', 'pending');
-- o1's payment succeeds now, so its escrow is funded and ready for the release race; o2's stays pending for the webhook race.
select public.apply_provider_event('sandbox', 'evt-c1-ok', (select v from public.zz_ids where k = 't1'), 'SBX-C1', 'succeeded', 29000, 'USD', '{}');
commit;

-- Oversell fixtures: five buyers each want the only 10 scarce bags.
do $$
declare u uuid;
begin
  foreach u in array array['c0000000-0000-0000-0000-0000000000e1','c0000000-0000-0000-0000-0000000000e2','c0000000-0000-0000-0000-0000000000e3','c0000000-0000-0000-0000-0000000000e4','c0000000-0000-0000-0000-0000000000e5']::uuid[] loop
    insert into public.cart_items (profile_id, product_id, quantity) values (u, (select v from public.zz_ids where k = 'scarce'), 10);
  end loop;
end $$;

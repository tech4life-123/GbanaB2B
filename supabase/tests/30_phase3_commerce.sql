-- ============================================================================
-- Phase 3 commerce: addresses, cart, checkout, order state machine, proforma
-- invoices, RLS isolation. Run with `npm run test:db`. Own fixtures.
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
-- Ada: seller (+ buyer, to test own-business rule) · Ben: seller · Cy: buyer
-- Dee: buyer · Eve: admin · Fay: no roles
insert into auth.users (id, phone) values
  ('30000000-0000-0000-0000-00000000000a', '231770300001'),
  ('30000000-0000-0000-0000-00000000000b', '231770300002'),
  ('30000000-0000-0000-0000-00000000000c', '231770300003'),
  ('30000000-0000-0000-0000-00000000000d', '231770300004'),
  ('30000000-0000-0000-0000-00000000000e', '231770300005'),
  ('30000000-0000-0000-0000-00000000000f', '231770300006');
insert into public.user_roles (user_id, role) values
  ('30000000-0000-0000-0000-00000000000a', 'seller'),
  ('30000000-0000-0000-0000-00000000000a', 'buyer'),
  ('30000000-0000-0000-0000-00000000000b', 'seller'),
  ('30000000-0000-0000-0000-00000000000c', 'buyer'),
  ('30000000-0000-0000-0000-00000000000d', 'buyer'),
  ('30000000-0000-0000-0000-00000000000e', 'admin');
update public.platform_settings set value = '250' where key = 'commerce.platform_fee_bps';  -- Phase 1 tests change it
update public.profiles set full_name = 'Cy Buyer' where id = '30000000-0000-0000-0000-00000000000c';

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

-- Ada: rice (USD, tiers 10/50/100) and oil (USD). Ben: cement (LRD) and flour (USD).
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
insert into ids select 'ada_biz', public.create_business('Ada Imports', 'importer', 'Montserrado', 'Waterside');
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g)
select (select v from ids where k = 'ada_biz'), (select id from public.product_categories where slug = 'rice-grains'), 'Ada rice 25kg', '25 kg bag', 'bag', 10, 200, 25000;
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g)
select (select v from ids where k = 'ada_biz'), (select id from public.product_categories where slug = 'cooking-oil'), 'Ada oil 20L', '20 L jerrycan', 'jerrycan', 5, 40, 18500;
insert into ids select 'rice', id from public.products where title = 'Ada rice 25kg';
insert into ids select 'oil', id from public.products where title = 'Ada oil 20L';
select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD',
  '[{"min_qty":10,"max_qty":49,"unit_price_minor":2450},{"min_qty":50,"max_qty":99,"unit_price_minor":2300},{"min_qty":100,"max_qty":null,"unit_price_minor":2150}]');
select public.save_product_pricing((select v from ids where k = 'oil'), 5, 'USD', '[{"min_qty":5,"max_qty":null,"unit_price_minor":3000}]');
update public.products set status = 'active' where business_id = (select v from ids where k = 'ada_biz');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
insert into ids select 'ben_biz', public.create_business('Ben Building Supply', 'wholesaler', 'Nimba', 'Ganta');
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g)
select (select v from ids where k = 'ben_biz'), (select id from public.product_categories limit 1), 'Ben cement 50kg', '50 kg bag', 'bag', 20, 1000, 50000;
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g)
select (select v from ids where k = 'ben_biz'), (select id from public.product_categories limit 1), 'Ben flour 50kg', '50 kg bag', 'bag', 10, 300, 50000;
insert into ids select 'cement', id from public.products where title = 'Ben cement 50kg';
insert into ids select 'flour', id from public.products where title = 'Ben flour 50kg';
select public.save_product_pricing((select v from ids where k = 'cement'), 20, 'LRD', '[{"min_qty":20,"max_qty":null,"unit_price_minor":185000}]');
select public.save_product_pricing((select v from ids where k = 'flour'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":3900}]');
update public.products set status = 'active' where business_id = (select v from ids where k = 'ben_biz');
commit;

-- ---------- addresses -------------------------------------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town, landmark)
values (auth.uid(), 'Shop', 'Cy Buyer', '+231770300003', 'Montserrado', 'Paynesville', 'Opposite Red Light market');
insert into ids select 'cy_shop', id from public.addresses where label = 'Shop';
select pg_temp.check((select is_default from public.addresses where id = (select v from ids where k = 'cy_shop')), 'first address becomes default');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town, is_default)
values (auth.uid(), 'Warehouse', 'Cy Buyer', '+231770300003', 'Margibi', 'Kakata', true);
insert into ids select 'cy_wh', id from public.addresses where label = 'Warehouse';
select pg_temp.check((select count(*) = 1 and bool_and(label = 'Warehouse') from public.addresses where is_default), 'new default replaces old default');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town, is_default)
values (auth.uid(), 'Temp', 'Cy Buyer', '+231770300003', 'Bomi', 'Tubmanburg', true);
delete from public.addresses where label = 'Temp';
select pg_temp.check((select count(*) = 1 from public.addresses where is_default), 'deleting the default promotes another address');
update public.addresses set is_default = true where label = 'Warehouse';
select pg_temp.expect_error($q$insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town) values (auth.uid(), 'Bad', 'Cy Buyer', '0770300003', 'Montserrado', 'Monrovia')$q$, 'address phone must be E.164');
select pg_temp.expect_error($q$insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town) values ('30000000-0000-0000-0000-00000000000d', 'Plant', 'Dee', '+231770300004', 'Montserrado', 'Monrovia')$q$, 'cannot create an address for someone else');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000d');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town)
values (auth.uid(), 'Dee store', 'Dee Buyer', '+231770300004', 'Bong', 'Gbarnga');
insert into ids select 'dee_addr', id from public.addresses where label = 'Dee store';
select pg_temp.check((select count(*) = 1 from public.addresses), 'buyer sees only own addresses');
update public.addresses set town = 'Hacked' where id = (select v from ids where k = 'cy_shop');
delete from public.addresses where id = (select v from ids where k = 'cy_wh');
commit;
select pg_temp.check((select count(*) = 2 and bool_and(town <> 'Hacked') from public.addresses where profile_id = '30000000-0000-0000-0000-00000000000c'), 'other buyers cannot edit or delete an address');

-- ---------- cart --------------------------------------------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000f');
select pg_temp.expect_error($q$insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'rice'), 10)$q$, 'user without buyer role cannot add to cart');
select pg_temp.expect_error($q$select public.place_orders(gen_random_uuid())$q$, 'user without buyer role cannot check out');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($q$insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'rice'), 10)$q$, 'seller cannot add own product to cart');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$insert into public.cart_items (profile_id, product_id, quantity) values ('30000000-0000-0000-0000-00000000000d', (select v from ids where k = 'rice'), 10)$q$, 'cannot fill someone else''s cart');
select pg_temp.expect_error($q$insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'rice'), 0)$q$, 'quantity must be positive');
select pg_temp.expect_error($q$insert into public.orders (order_number, buyer_id, seller_business_id, currency, subtotal_minor, platform_fee_bps, platform_fee_minor, total_minor, total_weight_g, item_count, buyer_snapshot, seller_snapshot, delivery_address) values ('X', auth.uid(), (select v from ids where k = 'ada_biz'), 'USD', 1, 0, 0, 1, 0, 1, '{}', '{}', '{}')$q$, 'buyers cannot insert orders directly');

insert into public.cart_items (profile_id, product_id, quantity) values
  (auth.uid(), (select v from ids where k = 'rice'), 5),
  (auth.uid(), (select v from ids where k = 'oil'), 6),
  (auth.uid(), (select v from ids where k = 'cement'), 20),
  (auth.uid(), (select v from ids where k = 'flour'), 10);
select pg_temp.expect_error($q$select public.place_orders((select v from ids where k = 'cy_shop'))$q$, 'checkout blocked below MOQ');
update public.cart_items set quantity = 60 where product_id = (select v from ids where k = 'rice');
select pg_temp.expect_error($q$select public.place_orders((select v from ids where k = 'dee_addr'))$q$, 'checkout requires own address');
update public.cart_items set quantity = 500 where product_id = (select v from ids where k = 'rice');
select pg_temp.expect_error($q$select public.place_orders((select v from ids where k = 'cy_shop'))$q$, 'checkout blocked above available stock');
update public.cart_items set quantity = 60 where product_id = (select v from ids where k = 'rice');
select pg_temp.expect_error($q$update public.cart_items set product_id = (select v from ids where k = 'flour') where product_id = (select v from ids where k = 'rice')$q$, 'cart line product cannot be swapped');
select pg_temp.expect_error($q$select public.place_orders((select v from ids where k = 'cy_shop'), null, repeat('x', 501))$q$, 'note length limited');

-- Place: 3 orders (Ada USD; Ben USD; Ben LRD)
create temp table placed as select unnest(public.place_orders((select v from ids where k = 'cy_shop'), '  Cy Provisions  ', 'Deliver before noon')) as id;
select pg_temp.check((select count(*) = 3 from placed), 'one order per seller and currency');
select pg_temp.check((select count(*) = 0 from public.cart_items), 'cart cleared after checkout');
commit;

insert into ids select 'ada_order', o.id from public.orders o where o.seller_business_id = (select v from ids where k = 'ada_biz');
insert into ids select 'ben_usd', o.id from public.orders o where o.seller_business_id = (select v from ids where k = 'ben_biz') and currency = 'USD';
insert into ids select 'ben_lrd', o.id from public.orders o where o.seller_business_id = (select v from ids where k = 'ben_biz') and currency = 'LRD';

-- snapshots and money (checked as superuser)
select pg_temp.check((select order_number ~ '^GB-[0-9]{4}-[0-9]{6}$' and status = 'pending_seller' and version = 1 from public.orders where id = (select v from ids where k = 'ada_order')), 'order number format and initial state');
-- rice 60 × 2300 (tier 50–99) + oil 6 × 3000 = 138000 + 18000 = 156000; fee 2.5% = 3900
select pg_temp.check((select subtotal_minor = 156000 and platform_fee_bps = 250 and platform_fee_minor = 3900 and total_minor = 156000 and freight_minor is null
                        and total_weight_g = 60*25000 + 6*18500 and item_count = 2 from public.orders where id = (select v from ids where k = 'ada_order')), 'subtotal, fee (seller-side), weight snapshot');
select pg_temp.check((select unit_price_minor = 2300 and line_total_minor = 138000 and tier_min_qty = 50 and tier_max_qty = 99 and title = 'Ada rice 25kg'
                        from public.order_items where product_id = (select v from ids where k = 'rice')), 'line priced at the matching tier');
select pg_temp.check((select currency = 'LRD' and subtotal_minor = 3700000 and platform_fee_minor = 92500 from public.orders where id = (select v from ids where k = 'ben_lrd')), 'LRD order kept separate');
select pg_temp.check((select buyer_snapshot->>'business_name' = 'Cy Provisions' and buyer_snapshot->>'name' = 'Cy Buyer'
                        and delivery_address->>'town' = 'Paynesville' and delivery_address->>'landmark' = 'Opposite Red Light market'
                        and seller_snapshot->>'name' = 'Ada Imports' and buyer_note = 'Deliver before noon'
                        from public.orders where id = (select v from ids where k = 'ada_order')), 'buyer, seller and address snapshots');
select pg_temp.check((select count(*) = 3 from public.order_status_history where to_status = 'pending_seller' and from_status is null and actor_role = 'buyer'), 'placement recorded in history');
select pg_temp.check((select quantity_available = 200 from public.products where id = (select v from ids where k = 'rice')), 'stock not reserved until the seller confirms');
select pg_temp.check(public.fee_for(99, 250) = 2 and public.fee_for(100, 250) = 3 and public.fee_for(101, 250) = 3 and public.fee_for(0, 250) = 0, 'fee rounds half-up');

-- later product edits do not change the order
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":9999}]');
update public.products set title = 'Renamed rice' where id = (select v from ids where k = 'rice');
commit;
select pg_temp.check((select unit_price_minor = 2300 and title = 'Ada rice 25kg' from public.order_items where product_id = (select v from ids where k = 'rice')), 'order items unaffected by later price/title edits');
select pg_temp.expect_error($q$update public.order_items set unit_price_minor = 1$q$, 'order items immutable (even for the owner role)');
select pg_temp.expect_error($q$delete from public.order_status_history$q$, 'status history append-only');

-- ---------- visibility ---------------------------------------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 3 from public.orders), 'buyer sees own orders');
select pg_temp.check((select count(*) = 4 from public.order_items), 'buyer sees own order items');
select pg_temp.expect_error($q$update public.orders set status = 'completed'$q$, 'buyer cannot update orders directly');
select pg_temp.expect_error($q$select nextval('public.order_number_seq')$q$, 'order number sequence not callable by clients');
select pg_temp.expect_error($q$select public.issue_proforma((select v from ids where k = 'ada_order'))$q$, 'issue_proforma is internal');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 0 from public.orders), 'another buyer sees no orders');
select pg_temp.check((select count(*) = 0 from public.order_items) and (select count(*) = 0 from public.order_status_history), 'another buyer sees no items or history');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'cancelled')$q$, 'another buyer cannot cancel');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 2 from public.orders), 'seller sees only orders placed with their business');
select pg_temp.check((select count(*) = 0 from public.orders where id = (select v from ids where k = 'ada_order')), 'seller cannot see a competitor''s order');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'confirmed')$q$, 'seller cannot confirm a competitor''s order');
select pg_temp.check((select count(*) = 0 from public.addresses), 'seller cannot read buyer address book');
commit;

-- ---------- state machine: Ada's order ------------------------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'confirmed')$q$, 'buyer cannot confirm');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'fulfilling')$q$, 'cannot skip confirmation');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'confirmed', null, 7)$q$, 'stale version rejected');
select public.transition_order((select v from ids where k = 'ada_order'), 'confirmed', 'Ready in 2 days', 1);
select pg_temp.check((select status = 'confirmed' and version = 2 and confirmed_at is not null from public.orders where id = (select v from ids where k = 'ada_order')), 'seller confirms');
select pg_temp.check((select quantity_available = 140 from public.products where id = (select v from ids where k = 'rice'))
                     and (select quantity_available = 34 from public.products where id = (select v from ids where k = 'oil')), 'confirmation reserves stock');
select pg_temp.check((select count(*) = 1 and bool_and(invoice_number ~ '^PI-[0-9]{4}-[0-9]{6}$' and revision = 1) from public.proforma_invoices where order_id = (select v from ids where k = 'ada_order')), 'proforma issued on confirmation');
select pg_temp.check((select (snapshot->>'subtotal_minor')::bigint = 156000 and jsonb_array_length(snapshot->'items') = 2 and jsonb_array_length(snapshot->'terms') = 5
                        and snapshot->>'payment_status' = 'unpaid' and (snapshot->>'valid_until')::timestamptz > now()
                        from public.proforma_invoices where order_id = (select v from ids where k = 'ada_order')), 'proforma snapshot complete');
select pg_temp.expect_error($q$update public.proforma_invoices set snapshot = '{}'$q$, 'seller cannot edit a proforma');
select public.transition_order((select v from ids where k = 'ada_order'), 'fulfilling');
select public.transition_order((select v from ids where k = 'ada_order'), 'ready_for_freight');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'paid_escrow')$q$, 'no payment transitions in Phase 3');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'cancelled')$q$, 'seller cancel requires a reason');
commit;
select pg_temp.expect_error($q$update public.proforma_invoices set snapshot = '{}'$q$, 'proforma immutable');

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 1 from public.proforma_invoices), 'buyer can read the proforma');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'cancelled', 'changed mind')$q$, 'buyer cannot cancel once ready for freight');
commit;

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
select public.transition_order((select v from ids where k = 'ada_order'), 'cancelled', 'Truck broke down');
select pg_temp.check((select status = 'cancelled' and cancelled_by = 'seller' and cancellation_reason = 'Truck broke down' from public.orders where id = (select v from ids where k = 'ada_order')), 'seller cancels with reason');
select pg_temp.check((select quantity_available = 200 from public.products where id = (select v from ids where k = 'rice'))
                     and (select quantity_available = 40 from public.products where id = (select v from ids where k = 'oil')), 'cancelling restores reserved stock');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ada_order'), 'confirmed')$q$, 'cancelled is terminal');
commit;
select pg_temp.check((select array_agg(to_status::text order by id) = array['pending_seller','confirmed','fulfilling','ready_for_freight','cancelled']
                        from public.order_status_history where order_id = (select v from ids where k = 'ada_order')), 'full history recorded in order');

-- ---------- buyer cancellation + window: Ben's orders ----------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select public.transition_order((select v from ids where k = 'ben_lrd'), 'cancelled');
select pg_temp.check((select status = 'cancelled' and cancelled_by = 'buyer' from public.orders where id = (select v from ids where k = 'ben_lrd')), 'buyer cancels a pending order without a reason');
commit;
select pg_temp.check((select quantity_available = 1000 from public.products where id = (select v from ids where k = 'cement')), 'cancelling an unconfirmed order leaves stock alone');

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select public.transition_order((select v from ids where k = 'ben_usd'), 'confirmed');
commit;
update public.orders set placed_at = now() - interval '2 hours' where id = (select v from ids where k = 'ben_usd');
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'ben_usd'), 'cancelled')$q$, 'buyer cannot cancel a confirmed order after the window');
commit;
update public.orders set placed_at = now() where id = (select v from ids where k = 'ben_usd');
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
select public.transition_order((select v from ids where k = 'ben_usd'), 'cancelled');
select pg_temp.check((select status = 'cancelled' from public.orders where id = (select v from ids where k = 'ben_usd')), 'buyer can cancel a confirmed order inside the window');
commit;
select pg_temp.check((select quantity_available = 300 from public.products where id = (select v from ids where k = 'flour')), 'buyer cancellation restores stock');

-- ---------- stock race + admin ----------------------------------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000d');
insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'flour'), 250);
insert into ids select 'dee_order', (public.place_orders((select v from ids where k = 'dee_addr')))[1];
commit;
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'flour'), 100);
insert into ids select 'cy_flour', (public.place_orders((select v from ids where k = 'cy_shop')))[1];
commit;
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000b');
select public.transition_order((select v from ids where k = 'dee_order'), 'confirmed');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'cy_flour'), 'confirmed')$q$, 'cannot confirm when stock was taken by another order');
commit;
select pg_temp.check((select quantity_available = 50 and status = 'active' from public.products where id = (select v from ids where k = 'flour')), 'stock never goes negative');

begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) >= 5 from public.orders), 'admin sees all orders');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'cy_flour'), 'confirmed')$q$, 'admin cannot confirm on a seller''s behalf');
select pg_temp.expect_error($q$select public.transition_order((select v from ids where k = 'cy_flour'), 'cancelled')$q$, 'admin cancel requires a reason');
select public.transition_order((select v from ids where k = 'cy_flour'), 'cancelled', 'Seller out of stock');
select pg_temp.check((select cancelled_by = 'admin' from public.orders where id = (select v from ids where k = 'cy_flour')), 'admin cancels with reason');
commit;
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'order.admin_transition' and entity_id = (select v from ids where k = 'cy_flour')::text), 'admin transition audited');

-- ---------- product becomes unavailable before checkout --------------------------------
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000d');
insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'oil'), 5);
commit;
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000a');
update public.products set status = 'paused' where id = (select v from ids where k = 'oil');
commit;
begin;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 1 from public.cart_items), 'cart line survives the product being paused');
select pg_temp.expect_error($q$select public.place_orders((select v from ids where k = 'dee_addr'))$q$, 'checkout blocked for paused products');
select pg_temp.check((select count(*) = 1 from public.cart_items), 'failed checkout leaves the cart intact');
commit;

\echo 'ALL PHASE 3 COMMERCE TESTS PASSED'

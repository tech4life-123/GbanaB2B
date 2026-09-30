-- ============================================================================
-- Phase 6 delivery & trust: pickup, tracking, delivery code, buyer confirmation,
-- auto-release, disputes + evidence, partial refunds, reviews, trust counters,
-- unpaid-order expiry. Run with `npm run test:db`. Own fixtures.
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

-- Sam seller · Bea buyer · Zed other buyer · Cal carrier · Dan other carrier · Ada admin
insert into auth.users (id, phone) values
  ('60000000-0000-0000-0000-00000000000a', '231770600001'), ('60000000-0000-0000-0000-00000000000b', '231770600002'),
  ('60000000-0000-0000-0000-00000000000d', '231770600004'), ('60000000-0000-0000-0000-00000000000c', '231770600003'),
  ('60000000-0000-0000-0000-00000000000e', '231770600005'), ('60000000-0000-0000-0000-000000000009', '231770600009');
insert into public.user_roles (user_id, role) values
  ('60000000-0000-0000-0000-00000000000a', 'seller'), ('60000000-0000-0000-0000-00000000000b', 'buyer'),
  ('60000000-0000-0000-0000-00000000000d', 'buyer'), ('60000000-0000-0000-0000-00000000000c', 'carrier'),
  ('60000000-0000-0000-0000-00000000000e', 'carrier'), ('60000000-0000-0000-0000-000000000009', 'admin');
update public.platform_settings set value = '250' where key = 'commerce.platform_fee_bps';
update public.platform_settings set value = '48' where key = 'freight.bid_expiry_hours';
update public.platform_settings set value = '1' where key = 'payments.sandbox_enabled';

insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties, verification_status, verified_at) values
  ('60000000-0000-0000-0000-00000000000c', 'Cal Cargo', '+231770600003', 'Duala', 'Montserrado', 'Monrovia', array['Montserrado', 'Bong'], 'verified', now()),
  ('60000000-0000-0000-0000-00000000000e', 'Dan Drive', '+231770600005', 'Red Light', 'Montserrado', 'Paynesville', array['Montserrado', 'Bong'], 'verified', now());
insert into public.vehicles (carrier_id, vehicle_type, plate_number, payload_kg, is_verified) values
  ('60000000-0000-0000-0000-00000000000c', 'box_truck', 'CAL-601', 8000, true),
  ('60000000-0000-0000-0000-00000000000e', 'box_truck', 'DAN-601', 8000, true);
update public.vehicles set is_verified = true where plate_number in ('CAL-601', 'DAN-601');

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
insert into ids select 'biz', public.create_business('Sam Supply 6', 'wholesaler', 'Montserrado', 'Waterside', null, '+231770600001');
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g, unit_volume_cm3, is_fragile)
select (select v from ids where k = 'biz'), (select id from public.product_categories limit 1), 'Sam rice P6', '25 kg bag', 'bag', 10, 1000, 25000, 30000, false;
insert into ids select 'rice', id from public.products where title = 'Sam rice P6';
select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":2400}]');
update public.products set status = 'active' where id = (select v from ids where k = 'rice');
commit;

-- Eleven orders of 10 bags: 24000 subtotal, 600 fee, 5000 freight → 29000 total. Cal is booked on all.
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town)
values (auth.uid(), 'Store', 'Bea Buyer', '+231770600002', 'Bong', 'Gbarnga');
do $$ declare i integer; oid uuid; begin
  for i in 1..11 loop
    insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'rice'), 10);
    oid := (public.place_orders((select id from public.addresses limit 1)))[1];
    insert into ids values ('o' || i, oid);
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
do $$ declare i integer; begin
  for i in 1..11 loop
    perform public.transition_order((select v from ids where k = 'o' || i), 'confirmed');
    perform public.transition_order((select v from ids where k = 'o' || i), 'fulfilling');
    perform public.transition_order((select v from ids where k = 'o' || i), 'ready_for_freight');
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..11 loop insert into ids values ('r' || i, public.create_freight_rfq((select v from ids where k = 'o' || i), current_date + 1)); end loop;
end $$;
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
do $$ declare i integer; begin
  for i in 1..11 loop
    insert into ids values ('b' || i, public.submit_freight_bid((select v from ids where k = 'r' || i), (select id from public.vehicles where plate_number = 'CAL-601'), 5000, 10, current_date + 2));
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..11 loop perform public.select_freight_bid((select v from ids where k = 'b' || i)); end loop;
end $$;
commit;

-- Pay orders 1-6, 8, 10, 11 (7 and 9 stay unpaid for the expiry tests).
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..11 loop
    if i not in (7, 9) then
      insert into ids values ('t' || i, public.start_payment((select v from ids where k = 'o' || i), 'sandbox', '+231770600002', 'idem-p6-order-' || i));
    end if;
  end loop;
end $$;
commit;
begin;
set local role service_role;
do $$ declare i integer; begin
  for i in 1..11 loop
    if i not in (7, 9) then
      perform public.record_payment_attempt((select v from ids where k = 't' || i), 'SBX6-' || i, 'pending');
      perform public.apply_provider_event('sandbox', 'evt-p6-' || i, (select v from ids where k = 't' || i), 'SBX6-' || i, 'succeeded', 29000, 'USD', '{}');
    end if;
  end loop;
end $$;
commit;
select pg_temp.check((select count(*) = 9 and bool_and(status = 'paid_escrow') from public.orders where id in (select v from ids where k ~ '^o([1-6]|8|10|11)$')), 'fixtures: nine orders paid into escrow');

-- ---------- pickup ------------------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error(format($q$select public.carrier_mark_picked_up(%L)$q$, (select v from ids where k = 'o1')), 'another carrier cannot pick up this delivery');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.carrier_mark_picked_up(%L)$q$, (select v from ids where k = 'o1')), 'the buyer cannot mark pickup');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$select public.carrier_mark_picked_up(%L)$q$, (select v from ids where k = 'o7')), 'no pickup before payment is held in escrow');
select public.carrier_mark_picked_up((select v from ids where k = 'o1'), 'Loaded at Waterside');
select pg_temp.expect_error(format($q$select public.carrier_mark_picked_up(%L)$q$, (select v from ids where k = 'o1')), 'pickup cannot be repeated');
select pg_temp.check((select count(*) = 0 from public.delivery_codes), 'the carrier cannot read the delivery code');
select pg_temp.check((select count(*) = 0 from public.orders), 'the carrier does not see the order itself (only the assignment)');
select pg_temp.expect_error($q$update public.delivery_codes set attempts = 0$q$, 'the carrier cannot change the code');
commit;
select pg_temp.check((select status = 'in_transit' from public.orders where id = (select v from ids where k = 'o1')), 'pickup moves the order to in transit');
select pg_temp.check((select code ~ '^[0-9]{6}$' and attempts = 0 and not locked from public.delivery_codes where order_id = (select v from ids where k = 'o1')), 'a 6-digit code exists for the order');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 from public.delivery_codes), 'the buyer can read the delivery code');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 0 from public.delivery_codes), 'the seller cannot read the delivery code');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) = 0 from public.delivery_codes), 'not even an admin can read the delivery code');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 0 from public.delivery_codes) and (select count(*) = 0 from public.delivery_events) and (select count(*) = 0 from public.order_deliveries), 'another buyer sees no delivery data');
commit;

-- ---------- tracking ------------------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$select public.carrier_post_checkpoint(%L, null, null, null)$q$, (select v from ids where k = 'o1')), 'an empty update is refused');
select pg_temp.expect_error(format($q$select public.carrier_post_checkpoint(%L, 'x', 95, 10)$q$, (select v from ids where k = 'o1')), 'an impossible latitude is refused');
select pg_temp.expect_error(format($q$select public.carrier_post_checkpoint(%L, 'x', 6.3, null)$q$, (select v from ids where k = 'o1')), 'half a location is refused');
select public.carrier_post_checkpoint((select v from ids where k = 'o1'), 'Passing Kakata', 6.53172, -10.35138);
select pg_temp.check((select lat = 6.5317 and lng = -10.3514 from public.delivery_events where kind = 'checkpoint'), 'location is rounded to about ten metres');
select pg_temp.expect_error(format($q$select public.carrier_post_checkpoint(%L, 'again', 6.6, -10.4)$q$, (select v from ids where k = 'o1')), 'checkpoints are rate-limited (no GPS streaming)');
select pg_temp.expect_error($q$insert into public.delivery_events (order_id, kind, actor_role) select id, 'checkpoint', 'carrier' from public.orders limit 1$q$, 'events cannot be written directly');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 2 from public.delivery_events), 'the buyer sees pickup and the checkpoint');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 2 from public.delivery_events), 'the seller sees the delivery timeline');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 0 from public.delivery_events), 'a stranger sees nothing');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select public.carrier_mark_arrived((select v from ids where k = 'o1'), 'At the shop front');
select pg_temp.check((select arrived_at is not null from public.order_deliveries where order_id = (select v from ids where k = 'o1')), 'arrival time is recorded');
select public.carrier_report_delivery_failed((select v from ids where k = 'o1'), 'Shop was closed, waiting');
select pg_temp.check((select count(*) = 1 from public.delivery_events where kind = 'delivery_failed'), 'a failed attempt is recorded as an event');
commit;
select pg_temp.check((select status = 'awaiting_confirmation' from public.orders where id = (select v from ids where k = 'o1')), 'arrival waits for the buyer''s confirmation');

-- ---------- the delivery code ----------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$select public.carrier_confirm_delivery(%L, '12')$q$, (select v from ids where k = 'o1')), 'the code must be six digits');
commit;
-- pick a wrong code that cannot equal the real one
create temp table wrong (c text);
grant all on wrong to public;
insert into wrong select case when code = '000000' then '111111' else '000000' end from public.delivery_codes where order_id = (select v from ids where k = 'o1');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error(format($q$select public.carrier_confirm_delivery(%L, '123456')$q$, (select v from ids where k = 'o1')), 'another carrier cannot use the code');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from wrong)) = 'wrong_code', 'a wrong code is rejected');
commit;
select pg_temp.check((select attempts = 1 from public.delivery_codes where order_id = (select v from ids where k = 'o1')), 'the wrong attempt was counted (and kept)');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from wrong));
select public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from wrong));
select public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from wrong));
select pg_temp.check(public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from wrong)) = 'locked', 'the fifth wrong try locks the code');
commit;
create temp table realcode (c text);
grant all on realcode to public;
insert into realcode select code from public.delivery_codes where order_id = (select v from ids where k = 'o1');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from realcode)) = 'locked', 'even the right code is refused while locked');
commit;
select pg_temp.check((select status = 'awaiting_confirmation' from public.orders where id = (select v from ids where k = 'o1')), 'nothing is released while locked');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.regenerate_delivery_code(%L)$q$, (select v from ids where k = 'o1')), 'another buyer cannot renew the code');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select public.regenerate_delivery_code((select v from ids where k = 'o1'));
select pg_temp.check((select attempts = 0 and not locked from public.delivery_codes), 'the buyer issued a new code and cleared the lock');
commit;
truncate realcode;
insert into realcode select code from public.delivery_codes where order_id = (select v from ids where k = 'o1');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.carrier_confirm_delivery((select v from ids where k = 'o1'), (select c from realcode)) = 'confirmed', 'the correct code confirms delivery');
select pg_temp.expect_error(format($q$select public.carrier_confirm_delivery(%L, %L)$q$, (select v from ids where k = 'o1'), (select c from realcode)), 'the code cannot be used twice');
commit;
select pg_temp.check((select status = 'completed' from public.orders where id = (select v from ids where k = 'o1')), 'confirmed delivery completes the order');
select pg_temp.check((select status = 'released' from public.escrow_accounts where order_id = (select v from ids where k = 'o1')), 'escrow released by the code');
select pg_temp.check((select count(*) = 2 and sum(amount_minor) = 28400 from public.payouts where order_id = (select v from ids where k = 'o1')), 'payouts: seller 23400 + carrier 5000');
select pg_temp.check((select confirmation_method = 'buyer_code' and completed_at is not null from public.order_deliveries where order_id = (select v from ids where k = 'o1')), 'confirmation method recorded');
select pg_temp.check((select count(*) = 1 from public.order_status_history where order_id = (select v from ids where k = 'o1') and to_status = 'delivered'), 'history shows delivered then completed');
select pg_temp.check((select status = 'completed' from public.carrier_assignments where order_id = (select v from ids where k = 'o1')), 'assignment marked completed');
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'escrow.released' and entity_id = (select v::text from ids where k = 'o1') and metadata ->> 'method' = 'buyer_code'), 'release is audited with its method');

-- ---------- the buyer confirms ------------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select public.carrier_mark_picked_up((select v from ids where k = 'o2'));
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$select public.buyer_confirm_delivery(%L)$q$, (select v from ids where k = 'o2')), 'the seller cannot confirm delivery for the buyer');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.buyer_confirm_delivery(%L)$q$, (select v from ids where k = 'o2')), 'another buyer cannot confirm');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.buyer_confirm_delivery(%L)$q$, (select v from ids where k = 'o3')), 'the buyer cannot confirm before pickup');
select pg_temp.check(public.buyer_confirm_delivery((select v from ids where k = 'o2')), 'the buyer confirms receipt');
select pg_temp.check(public.buyer_confirm_delivery((select v from ids where k = 'o2')) = false, 'confirming twice does nothing');
commit;
select pg_temp.check((select count(*) = 2 from public.payouts where order_id = (select v from ids where k = 'o2')), 'confirmation created the payouts once');

-- ---------- a dispute freezes the money -------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select public.carrier_mark_picked_up((select v from ids where k = 'o3'));
select public.carrier_mark_picked_up((select v from ids where k = 'o4'));
select public.carrier_mark_picked_up((select v from ids where k = 'o5'));
select public.carrier_mark_picked_up((select v from ids where k = 'o6'));
select public.carrier_mark_picked_up((select v from ids where k = 'o10'));
select public.carrier_mark_picked_up((select v from ids where k = 'o8'));
select public.carrier_mark_arrived((select v from ids where k = 'o8'));
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.open_dispute(%L, 'damaged_goods', 'Bags arrived torn and wet')$q$, (select v from ids where k = 'o3')), 'a stranger cannot open a dispute');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.open_dispute(%L, 'damaged_goods', 'too short')$q$, (select v from ids where k = 'o3')), 'the description must be meaningful');
select pg_temp.expect_error(format($q$select public.open_dispute(%L, 'damaged_goods', 'Bags arrived torn and wet', 999999)$q$, (select v from ids where k = 'o3')), 'a refund request above the order total is refused');
select pg_temp.expect_error(format($q$select public.open_dispute(%L, 'damaged_goods', 'Bags arrived torn and wet')$q$, (select v from ids where k = 'o7')), 'an unpaid order cannot be disputed');
insert into ids select 'd3', public.open_dispute((select v from ids where k = 'o3'), 'damaged_goods', 'Twelve bags arrived torn and wet', 6000);
select pg_temp.check((select status = 'disputed' from public.orders where id = (select v from ids where k = 'o3')), 'opening a dispute freezes the order');
select pg_temp.expect_error(format($q$select public.open_dispute(%L, 'missing_items', 'Also some bags are missing')$q$, (select v from ids where k = 'o3')), 'only one live dispute per order');
select pg_temp.expect_error(format($q$select public.buyer_confirm_delivery(%L)$q$, (select v from ids where k = 'o3')), 'the buyer cannot confirm while disputing');
insert into ids select 'd4', public.open_dispute((select v from ids where k = 'o4'), 'incorrect_product', 'We received cooking oil instead of rice');
insert into ids select 'd6', public.open_dispute((select v from ids where k = 'o6'), 'carrier_issue', 'The driver left the goods at the wrong place');
insert into ids select 'd10', public.open_dispute((select v from ids where k = 'o10'), 'missing_items', 'Three pallets are missing from the load');
select pg_temp.check((select count(*) = 4 from public.disputes), 'the buyer sees their four disputes');
select pg_temp.check((select dispute_number ~ '^D-[0-9]+$' from public.disputes where id = (select v from ids where k = 'd3')), 'disputes get a readable number');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$select public.carrier_confirm_delivery(%L, '123456')$q$, (select v from ids where k = 'o3')), 'the delivery code is refused during a dispute');
insert into ids select 'd5', public.open_dispute((select v from ids where k = 'o5'), 'delivery_failure', 'The buyer refused to accept the goods at the door');
select pg_temp.check((select opened_by_role = 'carrier' from public.disputes where id = (select v from ids where k = 'd5')), 'the carrier can raise a dispute too');
select pg_temp.expect_error(format($q$select public.open_dispute(%L, 'delivery_failure', 'I want a refund of the goods', 100)$q$, (select v from ids where k = 'o8')), 'only a buyer can request a refund amount');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 5 from public.disputes), 'the seller sees disputes on their orders');
select public.add_dispute_message((select v from ids where k = 'd3'), 'We packed these bags in sealed plastic; please share the photos.');
select pg_temp.expect_error(format($q$select public.withdraw_dispute(%L)$q$, (select v from ids where k = 'd3')), 'only the opener can withdraw a dispute');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 0 from public.disputes) and (select count(*) = 0 from public.dispute_messages) and (select count(*) = 0 from public.dispute_evidence), 'a stranger sees no disputes');
select pg_temp.expect_error(format($q$select public.add_dispute_message(%L, 'hello')$q$, (select v from ids where k = 'd3')), 'a stranger cannot post in a dispute');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.expect_error(format($q$select public.admin_release_escrow(%L, 'release now please')$q$, (select v from ids where k = 'o3')), 'admin cannot release funds around a live dispute');
select pg_temp.expect_error(format($q$select public.admin_refund_escrow(%L, 'refund now please')$q$, (select v from ids where k = 'o3')), 'admin cannot refund around a live dispute');
commit;

-- evidence (private bucket)
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.register_dispute_evidence(%L, %L, 'x.jpg', 'image/jpeg', 1000)$q$, (select v from ids where k = 'd3'), 'somewhere/else.jpg'), 'evidence must live in the dispute''s own folder');
insert into storage.objects (bucket_id, name) values ('dispute-evidence', (select v from ids where k = 'd3') || '/11111111-1111-1111-1111-111111111111.jpg');
select public.register_dispute_evidence((select v from ids where k = 'd3'), (select v from ids where k = 'd3') || '/11111111-1111-1111-1111-111111111111.jpg', 'torn-bags.jpg', 'image/jpeg', 204800, 'Torn bags at the door');
select pg_temp.check((select count(*) = 1 from public.dispute_evidence), 'the buyer registered evidence');
select pg_temp.expect_error($q$update public.dispute_evidence set caption = 'changed'$q$, 'evidence cannot be edited');
select pg_temp.expect_error($q$delete from public.dispute_evidence$q$, 'evidence cannot be deleted');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('dispute-evidence', %L)$q$, (select v from ids where k = 'd5') || '/22222222-2222-2222-2222-222222222222.jpg'), 'another carrier cannot upload into a dispute they are not in');
select pg_temp.expect_error(format($q$select public.register_dispute_evidence(%L, %L, 'x.jpg', 'image/jpeg', 10)$q$, (select v from ids where k = 'd5'), (select v from ids where k = 'd5') || '/22222222-2222-2222-2222-222222222222.jpg'), 'and cannot register evidence there either');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('dispute-evidence', %L)$q$, (select v from ids where k = 'd3') || '/33333333-3333-3333-3333-333333333333.jpg'), 'a stranger cannot upload evidence');
select pg_temp.check((select count(*) = 0 from storage.objects where bucket_id = 'dispute-evidence'), 'a stranger cannot see evidence files');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 1 from public.dispute_evidence) and (select count(*) = 1 from storage.objects where bucket_id = 'dispute-evidence'), 'the seller can see the evidence on their dispute');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) = 1 from storage.objects where bucket_id = 'dispute-evidence'), 'admins can see the evidence');
commit;

-- withdraw restores the order
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.withdraw_dispute((select v from ids where k = 'd10'), 'Found them — sorry'), 'the opener can withdraw');
select pg_temp.check((select status = 'in_transit' from public.orders where id = (select v from ids where k = 'o10')), 'withdrawing puts the order back where it was');
select pg_temp.check((select status = 'resolved' and resolution = 'withdrawn' from public.disputes where id = (select v from ids where k = 'd10')), 'the dispute is closed as withdrawn');
select pg_temp.expect_error(format($q$select public.add_dispute_message(%L, 'one more thing')$q$, (select v from ids where k = 'd10')), 'a closed dispute takes no more messages');
commit;

-- ---------- admin decisions -----------------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'refund', 'Refund the buyer in full, goods were ruined')$q$, (select v from ids where k = 'd3')), 'the buyer cannot decide their own dispute');
select pg_temp.expect_error(format($q$select public.admin_start_dispute_review(%L)$q$, (select v from ids where k = 'd3')), 'only admins can start a review');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'reject', 'The seller says everything was fine')$q$, (select v from ids where k = 'd3')), 'the seller cannot decide either');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.check(public.admin_start_dispute_review((select v from ids where k = 'd3')), 'admin starts the review');
select pg_temp.check((select status = 'under_review' from public.disputes where id = (select v from ids where k = 'd3')), 'status is under review');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'partial_refund', 'Partial refund for torn bags', 'seller', 0)$q$, (select v from ids where k = 'd3')), 'a zero refund is refused');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'partial_refund', 'Partial refund for torn bags', 'seller', 29000)$q$, (select v from ids where k = 'd3')), 'a "partial" refund of everything is refused');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'partial_refund', 'Partial refund for torn bags', 'seller', 24001)$q$, (select v from ids where k = 'd3')), 'a goods refund above the goods value is refused');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'partial_refund', 'Partial refund for torn bags', 'none', 5000)$q$, (select v from ids where k = 'd3')), 'a partial refund must say whose share pays');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'refund', 'short')$q$, (select v from ids where k = 'd3')), 'the decision must be explained');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'jackpot', 'Pay the buyer everything please')$q$, (select v from ids where k = 'd3')), 'unknown outcomes are refused');
select pg_temp.check(public.admin_resolve_dispute((select v from ids where k = 'd3'), 'partial_refund', 'Torn bags confirmed by photos; 5000 refunded from the goods', 'seller', 5000) = 'partial_refund', 'partial refund decided');
select pg_temp.check(public.admin_resolve_dispute((select v from ids where k = 'd3'), 'partial_refund', 'Torn bags confirmed by photos; 5000 refunded from the goods', 'seller', 5000) = 'partial_refund', 'deciding the same way twice changes nothing');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'reject', 'Changing my mind after the decision')$q$, (select v from ids where k = 'd3')), 'a closed dispute cannot be re-decided differently');
select pg_temp.check((select status = 'partially_refunded' from public.orders where id = (select v from ids where k = 'o3')), 'order is partially refunded');
select pg_temp.check((select amount_minor = 5000 and status = 'pending' from public.refunds where order_id = (select v from ids where k = 'o3')), 'a 5000 refund is queued for the buyer');
select pg_temp.check((select refunded_minor = 5000 and status = 'released' from public.escrow_accounts where order_id = (select v from ids where k = 'o3')), 'escrow shows 5000 refunded');
-- fee shrinks with the goods value: fee(19000) = 475, seller 18525, carrier 5000, refund 5000 = 29000
select pg_temp.check((select sum(amount_minor) filter (where recipient = 'seller') = 18525 and sum(amount_minor) filter (where recipient = 'carrier') = 5000 from public.payouts where order_id = (select v from ids where k = 'o3')), 'payouts: seller 18525 (fee shrank), carrier 5000');
select pg_temp.check((select sum(amount_minor) = 475 from public.ledger_entries where order_id = (select v from ids where k = 'o3') and kind = 'escrow_partial_refund' and account = 'platform_fees'), 'platform fee became 475');
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'dispute.resolved' and entity_id = (select v::text from ids where k = 'd3')), 'the decision is audited');
commit;

begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.check(public.admin_resolve_dispute((select v from ids where k = 'd4'), 'refund', 'Wrong goods delivered; full refund to the buyer', 'seller') = 'refunded', 'full refund decided');
select pg_temp.check((select status = 'refunded' from public.orders where id = (select v from ids where k = 'o4')), 'order refunded');
select pg_temp.check((select amount_minor = 29000 from public.refunds where order_id = (select v from ids where k = 'o4')) and (select count(*) = 0 from public.payouts where order_id = (select v from ids where k = 'o4')), 'the buyer is owed everything; nobody is paid out');
select pg_temp.check((select status = 'cancelled' from public.carrier_assignments where order_id = (select v from ids where k = 'o4')), 'the carrier assignment is cancelled on a full refund');
select pg_temp.check(public.admin_resolve_dispute((select v from ids where k = 'd5'), 'reject', 'The goods were as ordered; the buyer simply refused them', 'none') = 'rejected', 'a rejected claim is decided');
select pg_temp.check((select status = 'completed' from public.orders where id = (select v from ids where k = 'o5')), 'rejecting the claim releases the funds as normal');
select pg_temp.check((select count(*) = 2 from public.payouts where order_id = (select v from ids where k = 'o5')), 'seller and carrier are paid after a rejection');
select pg_temp.check(public.admin_resolve_dispute((select v from ids where k = 'd6'), 'partial_refund', 'Driver mis-delivered; 2000 of the freight charge returned', 'carrier', 2000) = 'partial_refund', 'carrier-funded partial refund decided');
select pg_temp.check((select sum(amount_minor) filter (where recipient = 'seller') = 23400 and sum(amount_minor) filter (where recipient = 'carrier') = 3000 from public.payouts where order_id = (select v from ids where k = 'o6')), 'carrier pays the 2000: seller 23400, carrier 3000');
select pg_temp.expect_error(format($q$select public.admin_resolve_dispute(%L, 'partial_refund', 'Freight refund above the freight charge', 'carrier', 5001)$q$, (select v from ids where k = 'd10')), 'a withdrawn dispute is closed and cannot be decided');
commit;

-- ---------- money stays consistent --------------------------------------------------------------
select pg_temp.check((select sum(case direction when 'debit' then amount_minor else -amount_minor end) = 0 from public.ledger_entries), 'the whole ledger still balances to zero');
select pg_temp.check((select coalesce(sum(amount_minor), 0) from public.escrow_accounts where status = 'held') = (select balance_minor from public.ledger_balances where account = 'escrow' and currency = 'USD'), 'the escrow ledger equals the escrow still held');
select pg_temp.check((select count(*) = 0 from public.escrow_accounts e where e.status <> 'held' and e.amount_minor <> e.fee_minor + e.seller_net_minor + e.carrier_net_minor), 'escrow shares always add up to the amount');

-- ---------- auto-release ---------------------------------------------------------------------------
select pg_temp.check((select arrived_at is not null and completed_at is null from public.order_deliveries where order_id = (select v from ids where k = 'o8')), 'order 8 is waiting for confirmation');
update public.order_deliveries set arrived_at = now() - interval '71 hours' where order_id = (select v from ids where k = 'o8');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.sweep_overdue_orders()$q$, 'a buyer cannot run the sweep');
commit;
begin;
set local role service_role;
select pg_temp.check((public.sweep_overdue_orders() ->> 'auto_released')::int = 0, 'nothing is released before the window ends');
commit;
update public.order_deliveries set arrived_at = now() - interval '73 hours' where order_id = (select v from ids where k = 'o8');
begin;
set local role service_role;
select pg_temp.check((public.sweep_overdue_orders() ->> 'auto_released')::int = 1, 'silence after the window releases the funds');
select pg_temp.check((public.sweep_overdue_orders() ->> 'auto_released')::int = 0, 'the sweep is idempotent');
commit;
select pg_temp.check((select status = 'completed' from public.orders where id = (select v from ids where k = 'o8')) and (select confirmation_method = 'auto' from public.order_deliveries where order_id = (select v from ids where k = 'o8')), 'order 8 completed automatically');
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'escrow.released' and entity_id = (select v::text from ids where k = 'o8') and metadata ->> 'method' = 'auto' and actor_id is null), 'the automatic release is audited as the system');

-- ---------- unpaid orders ---------------------------------------------------------------------------
select pg_temp.check((select quantity_available from public.products where id = (select v from ids where k = 'rice')) = 1000 - 11 * 10, 'stock is reserved for all eleven orders');
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.cancel_unpaid_order(%L)$q$, (select v from ids where k = 'o9')), 'another buyer cannot cancel someone else''s order');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.cancel_unpaid_order(%L)$q$, (select v from ids where k = 'o11')), 'a paid order cannot be cancelled this way');
select pg_temp.check(public.cancel_unpaid_order((select v from ids where k = 'o9'), 'Changed my mind'), 'the buyer cancels before paying');
select pg_temp.check(public.cancel_unpaid_order((select v from ids where k = 'o9')) = false, 'cancelling twice does nothing');
commit;
select pg_temp.check((select status = 'cancelled' and cancelled_by = 'buyer' from public.orders where id = (select v from ids where k = 'o9')), 'order 9 is cancelled by the buyer');
select pg_temp.check((select status = 'cancelled' from public.carrier_assignments where order_id = (select v from ids where k = 'o9')) and (select status = 'cancelled' from public.freight_rfqs where order_id = (select v from ids where k = 'o9')), 'the freight booking is released');
select pg_temp.check((select quantity_available from public.products where id = (select v from ids where k = 'rice')) = 1000 - 10 * 10, 'the stock came back');
-- a payment in progress blocks cancelling
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
insert into ids select 't7', public.start_payment((select v from ids where k = 'o7'), 'sandbox', '+231770600002', 'idem-p6-order-7a');
select pg_temp.expect_error(format($q$select public.cancel_unpaid_order(%L)$q$, (select v from ids where k = 'o7')), 'cannot cancel while a payment waits for approval');
commit;
-- the sweep cancels stale unpaid orders (but never while a fresh payment is open)
update public.carrier_assignments set assigned_at = now() - interval '49 hours' where order_id = (select v from ids where k = 'o7');
begin;
set local role service_role;
select pg_temp.check((public.sweep_overdue_orders() ->> 'expired_unpaid')::int = 0, 'an order with a fresh payment attempt is not expired');
commit;
update public.payment_intents set expires_at = now() - interval '1 minute' where order_id = (select v from ids where k = 'o7');
begin;
set local role service_role;
select pg_temp.check((public.sweep_overdue_orders() ->> 'expired_unpaid')::int = 1, 'the sweep expires the unpaid order');
commit;
select pg_temp.check((select status = 'cancelled' and cancelled_by = 'system' from public.orders where id = (select v from ids where k = 'o7')), 'order 7 is cancelled by the system');
select pg_temp.check((select status = 'expired' from public.payment_transactions where id = (select v from ids where k = 't7')), 'its payment attempt is expired');
select pg_temp.check((select quantity_available from public.products where id = (select v from ids where k = 'rice')) = 1000 - 9 * 10, 'stock returned again');
begin;
set local role service_role;
-- A success that arrives after the order was cancelled cannot fund anything.
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-p6-late-7', (select v from ids where k = 't7'), 'SBX6-7', 'succeeded', 29000, 'USD', '{}') = 'orphan_success', 'a late payment on a cancelled order is parked for an admin');
commit;
select pg_temp.check((select count(*) = 0 from public.escrow_accounts where order_id = (select v from ids where k = 'o7')), 'no escrow was created for the cancelled order');

-- ---------- reviews -----------------------------------------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.submit_review(%L, 'seller', 5, 'Great')$q$, (select v from ids where k = 'o11')), 'no review before the order is complete');
select pg_temp.expect_error(format($q$select public.submit_review(%L, 'seller', 6, 'Great')$q$, (select v from ids where k = 'o1')), 'ratings run from 1 to 5');
select pg_temp.expect_error(format($q$select public.submit_review(%L, 'buyer', 5, 'Great')$q$, (select v from ids where k = 'o1')), 'only the seller or carrier can be reviewed');
insert into ids select 'rv1', public.submit_review((select v from ids where k = 'o1'), 'seller', 5, 'Rice was exactly as described.');
insert into ids select 'rv2', public.submit_review((select v from ids where k = 'o1'), 'carrier', 4, 'On time, polite driver.');
select pg_temp.expect_error(format($q$select public.submit_review(%L, 'seller', 1, 'Changed my mind')$q$, (select v from ids where k = 'o1')), 'one review per seller per order');
select pg_temp.check((select count(*) = 2 from public.order_review_status((select v from ids where k = 'o1'))), 'the buyer can see which reviews they already left');
select pg_temp.expect_error($q$update public.reviews set rating = 1$q$, 'ratings cannot be edited');
select pg_temp.expect_error($q$delete from public.reviews$q$, 'reviews cannot be deleted');
select pg_temp.expect_error($q$insert into public.reviews (order_id, reviewer_id, subject_kind, rating, reviewer_label) values (gen_random_uuid(), auth.uid(), 'seller', 5, 'x')$q$, 'reviews cannot be inserted directly');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.submit_review(%L, 'seller', 1, 'Fake')$q$, (select v from ids where k = 'o2')), 'a stranger cannot review an order');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 0 from public.order_review_status((select v from ids where k = 'o2'))), 'no reviews yet on order 2');
commit;
begin;
set local role anon;
select pg_temp.check((select count(*) >= 2 from public.reviews), 'reviews are public');
select pg_temp.expect_error($q$select reviewer_id from public.reviews$q$, 'the reviewer''s identity is not exposed');
select pg_temp.expect_error($q$select order_id from public.reviews$q$, 'the order is not exposed');
select pg_temp.check((select reviews_count = 1 and rating_sum = 5 and completed_orders >= 1 from public.trust_stats where subject_kind = 'seller' and subject_id = (select v from ids where k = 'biz')), 'seller trust: one review, rating 5');
select pg_temp.expect_error($q$update public.trust_stats set reviews_count = 99$q$, 'nobody can edit trust counters');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.reply_to_review(%L, 'Thanks everyone')$q$, (select v from ids where k = 'rv1')), 'a stranger cannot reply to a review');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error(format($q$select public.reply_to_review(%L, 'Not my review')$q$, (select v from ids where k = 'rv2')), 'another carrier cannot reply');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
select public.reply_to_review((select v from ids where k = 'rv1'), 'Thank you for the order!');
select pg_temp.expect_error(format($q$select public.reply_to_review(%L, 'Second reply')$q$, (select v from ids where k = 'rv1')), 'one reply per review');
select pg_temp.expect_error(format($q$select public.reply_to_review(%L, 'Seller replying for the carrier')$q$, (select v from ids where k = 'rv2')), 'the seller cannot answer for the carrier');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000c');
select public.reply_to_review((select v from ids where k = 'rv2'), 'Happy to help.');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.admin_hide_review(%L, true, 'I want it gone')$q$, (select v from ids where k = 'rv1')), 'users cannot hide reviews');
select pg_temp.check((select count(*) = 0 from public.admin_list_reviews()), 'the moderation list is empty for non-admins');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) = 2 from public.admin_list_reviews()), 'admins can list reviews for moderation');
select pg_temp.expect_error(format($q$select public.admin_hide_review(%L, true, '')$q$, (select v from ids where k = 'rv1')), 'hiding needs a reason');
select pg_temp.check(public.admin_hide_review((select v from ids where k = 'rv1'), true, 'Contains a personal phone number'), 'admin hides a review');
commit;
select pg_temp.check((select reviews_count = 0 and rating_sum = 0 from public.trust_stats where subject_kind = 'seller' and subject_id = (select v from ids where k = 'biz')), 'hiding removes it from the seller''s average');
begin;
set local role anon;
select pg_temp.check((select count(*) = 1 from public.reviews), 'a hidden review disappears from public view');
commit;
begin;
select pg_temp.as_user('60000000-0000-0000-0000-000000000009');
select pg_temp.check(public.admin_hide_review((select v from ids where k = 'rv1'), false), 'admin restores it');
commit;
select pg_temp.check((select reviews_count = 1 and rating_sum = 5 from public.trust_stats where subject_kind = 'seller' and subject_id = (select v from ids where k = 'biz')), 'restoring puts it back');
select pg_temp.check((select count(*) = 2 from public.audit_logs where action in ('review.hidden', 'review.restored')), 'moderation is audited');

-- ---------- trust counters ------------------------------------------------------------------------------
select pg_temp.check((select completed_orders = 6 and disputes_upheld = 2 and cancelled_by_subject = 0 from public.trust_stats where subject_kind = 'seller' and subject_id = (select v from ids where k = 'biz')),
  'seller: six completed orders (incl. two partly refunded), two upheld disputes, no cancellations');
select pg_temp.check((select completed_orders = 6 and disputes_upheld = 1 and reviews_count = 1 and rating_sum = 4 from public.trust_stats where subject_kind = 'carrier' and subject_id = '60000000-0000-0000-0000-00000000000c'),
  'carrier: six completed deliveries, one upheld dispute, one review');

-- ---------- nothing can be written around the workflows ---------------------------------------------------
begin;
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$update public.orders set status = 'completed'$q$, 'the buyer cannot complete an order by hand');
select pg_temp.expect_error($q$insert into public.disputes (order_id, opened_by, opened_by_role, kind, description, prior_order_status) select id, auth.uid(), 'buyer', 'damaged_goods', 'Direct insert attempt here', 'in_transit' from public.orders limit 1$q$, 'disputes cannot be inserted directly');
select pg_temp.expect_error($q$update public.disputes set status = 'refunded'$q$, 'a dispute status cannot be edited directly');
select pg_temp.expect_error($q$update public.escrow_accounts set status = 'refunded'$q$, 'escrow cannot be edited directly');
select pg_temp.expect_error($q$insert into public.dispute_messages (dispute_id, author_role, body) select id, 'admin', 'Decision: refund' from public.disputes limit 1$q$, 'messages cannot be forged directly');
select pg_temp.expect_error($q$select public.settle_escrow(gen_random_uuid(), null, 'buyer', 'buyer', 'x')$q$, 'the internal release function is not callable');
select pg_temp.expect_error($q$select public.refund_escrow_full(gen_random_uuid(), null, 'admin', 'x')$q$, 'the internal refund function is not callable');
select pg_temp.expect_error($q$select public.bump_trust('seller', gen_random_uuid(), 5)$q$, 'trust counters cannot be bumped by clients');
commit;
begin;
set local role anon;
select pg_temp.expect_error($q$select count(*) from public.disputes$q$, 'anon cannot read disputes');
select pg_temp.expect_error($q$select count(*) from public.delivery_events$q$, 'anon cannot read delivery events');
commit;

-- ---------- settings -----------------------------------------------------------------------------------------
select pg_temp.check((select count(*) = 6 from public.platform_settings where key in ('delivery.code_max_attempts', 'delivery.auto_confirm_hours', 'delivery.checkpoint_min_seconds', 'orders.payment_window_hours', 'disputes.max_evidence_files', 'reviews.window_days')), 'the new business rules are configurable');

\echo ALL PHASE 6 DELIVERY & TRUST TESTS PASSED

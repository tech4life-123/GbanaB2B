-- ============================================================================
-- Phase 4 freight exchange: carrier onboarding, private documents, admin
-- verification, eligibility, sealed bidding and carrier selection.
-- Run with `npm run test:db`. Own fixtures.
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

-- ---------- people ------------------------------------------------------------
-- a Sam: seller (+carrier, to test conflict of interest) · b Bea: buyer · c Cal: carrier (full onboarding)
-- d Dan: carrier, wrong coverage · e Eve: carrier, vehicle too small · f Fin: carrier, unverified
-- 1 Hal: carrier, eligible competitor · 9 Ada: admin · 8 Ned: no roles
insert into auth.users (id, phone) values
  ('40000000-0000-0000-0000-00000000000a', '231770400001'), ('40000000-0000-0000-0000-00000000000b', '231770400002'),
  ('40000000-0000-0000-0000-00000000000c', '231770400003'), ('40000000-0000-0000-0000-00000000000d', '231770400004'),
  ('40000000-0000-0000-0000-00000000000e', '231770400005'), ('40000000-0000-0000-0000-00000000000f', '231770400006'),
  ('40000000-0000-0000-0000-000000000001', '231770400007'), ('40000000-0000-0000-0000-000000000009', '231770400009'),
  ('40000000-0000-0000-0000-000000000008', '231770400008');
insert into public.user_roles (user_id, role) values
  ('40000000-0000-0000-0000-00000000000a', 'seller'), ('40000000-0000-0000-0000-00000000000a', 'carrier'),
  ('40000000-0000-0000-0000-00000000000b', 'buyer'),
  ('40000000-0000-0000-0000-00000000000c', 'carrier'), ('40000000-0000-0000-0000-00000000000d', 'carrier'),
  ('40000000-0000-0000-0000-00000000000e', 'carrier'), ('40000000-0000-0000-0000-00000000000f', 'carrier'),
  ('40000000-0000-0000-0000-000000000001', 'carrier'), ('40000000-0000-0000-0000-000000000009', 'admin');
update public.platform_settings set value = '48' where key = 'freight.bid_expiry_hours';

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

-- Pre-verified carriers set up directly (their onboarding isn't under test).
insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties, verification_status, verified_at) values
  ('40000000-0000-0000-0000-00000000000a', 'Sam Driver', '+231770400001', 'Waterside', 'Montserrado', 'Monrovia', array['Montserrado','Bong'], 'verified', now()),
  ('40000000-0000-0000-0000-00000000000d', 'Dan Haulage', '+231770400004', 'Red Light', 'Montserrado', 'Paynesville', array['Montserrado'], 'verified', now()),
  ('40000000-0000-0000-0000-00000000000e', 'Eve Moto', '+231770400005', 'Gbarnga', 'Bong', 'Gbarnga', array['Montserrado','Bong'], 'verified', now()),
  ('40000000-0000-0000-0000-00000000000f', 'Fin New', '+231770400006', 'Kakata', 'Margibi', 'Kakata', array['Montserrado','Bong'], 'pending', null),
  ('40000000-0000-0000-0000-000000000001', 'Hal Transport', '+231770400007', 'Gbarnga', 'Bong', 'Gbarnga', array['Montserrado','Bong','Nimba'], 'verified', now());
insert into public.vehicles (carrier_id, vehicle_type, plate_number, payload_kg, is_verified) values
  ('40000000-0000-0000-0000-00000000000a', 'box_truck', 'SAM-001', 8000, true),
  ('40000000-0000-0000-0000-00000000000d', 'flatbed_truck', 'DAN-001', 10000, true),
  ('40000000-0000-0000-0000-00000000000e', 'motorbike', 'EVE-001', 200, true),
  ('40000000-0000-0000-0000-00000000000f', 'box_truck', 'FIN-001', 8000, false),
  ('40000000-0000-0000-0000-000000000001', 'box_truck', 'HAL-001', 5000, true);
update public.vehicles set is_verified = true where plate_number in ('SAM-001', 'DAN-001', 'EVE-001', 'HAL-001');
insert into ids select 'hal_truck', id from public.vehicles where plate_number = 'HAL-001';
insert into ids select 'eve_bike', id from public.vehicles where plate_number = 'EVE-001';

-- ---------- a ready-for-freight order: Sam (Montserrado) → Bea (Bong) ----------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
insert into ids select 'sam_biz', public.create_business('Sam Supply', 'wholesaler', 'Montserrado', 'Waterside', null, '+231770400001');
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g, unit_volume_cm3, is_fragile)
select (select v from ids where k = 'sam_biz'), (select id from public.product_categories limit 1), 'Sam rice 25kg', '25 kg bag', 'bag', 10, 500, 25000, 30000, false;
insert into ids select 'rice', id from public.products where title = 'Sam rice 25kg';
select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":2400}]');
update public.products set status = 'active' where id = (select v from ids where k = 'rice');
commit;

begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town, landmark)
values (auth.uid(), 'Store', 'Bea Buyer', '+231770400002', 'Bong', 'Gbarnga', 'Near the market');
insert into public.cart_items (profile_id, product_id, quantity)
select auth.uid(), (select v from ids where k = 'rice'), 100;
insert into ids select 'order1', (public.place_orders((select id from public.addresses limit 1)))[1];
insert into public.cart_items (profile_id, product_id, quantity)
select auth.uid(), (select v from ids where k = 'rice'), 20;
insert into ids select 'order2', (public.place_orders((select id from public.addresses limit 1)))[1];
commit;

begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select public.transition_order((select v from ids where k = 'order1'), 'confirmed');
select public.transition_order((select v from ids where k = 'order2'), 'confirmed');
commit;

-- ---------- Cal onboards ----------------------------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000008');
select pg_temp.expect_error($q$insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties) values (auth.uid(), 'Ned', '+231770400008', 'x street', 'Bong', 'Gbarnga', array['Bong'])$q$, 'user without carrier role cannot create a carrier profile');
commit;

begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties, verification_status) values (auth.uid(), 'Cal', '+231770400003', 'Duala', 'Montserrado', 'Monrovia', array['Bong'], 'verified')$q$, 'carrier cannot self-verify on insert');
select pg_temp.expect_error($q$insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties) values (auth.uid(), 'Cal', '+231770400003', 'Duala', 'Montserrado', 'Monrovia', array['Atlantis'])$q$, 'coverage must be Liberian counties');
select pg_temp.expect_error($q$insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties) values ('40000000-0000-0000-0000-00000000000d', 'Fake', '+231770400003', 'Duala', 'Montserrado', 'Monrovia', array['Bong'])$q$, 'cannot create a profile for someone else');
insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties)
values (auth.uid(), 'Cal Cargo', '+231770400003', 'Duala Market Road', 'Montserrado', 'Monrovia', array['Montserrado', 'Bong']);
select pg_temp.check((select verification_status = 'pending' from public.carrier_profiles where id = auth.uid()), 'new carrier starts pending');
select pg_temp.expect_error($q$update public.carrier_profiles set verification_status = 'verified' where id = auth.uid()$q$, 'carrier cannot change own verification status');

insert into public.vehicles (carrier_id, vehicle_type, plate_number, make_model, payload_kg, cargo_volume_m3)
values (auth.uid(), 'box_truck', ' ab 1234 ', 'Isuzu NPR', 4000, 20);
insert into ids select 'cal_truck', id from public.vehicles where carrier_id = auth.uid();
select pg_temp.check((select plate_number = 'AB1234' and vehicle_class = 'large' and not is_verified from public.vehicles where carrier_id = auth.uid()), 'plate normalised, class derived from payload, unverified');
select pg_temp.expect_error($q$update public.vehicles set is_verified = true where carrier_id = auth.uid()$q$, 'carrier cannot verify own vehicle');
select pg_temp.expect_error($q$insert into public.vehicles (carrier_id, vehicle_type, plate_number, payload_kg) values ('40000000-0000-0000-0000-00000000000d', 'van', 'XX-999', 900)$q$, 'cannot add a vehicle to another carrier');
select pg_temp.expect_error($q$insert into public.vehicles (carrier_id, vehicle_type, plate_number, payload_kg) values (auth.uid(), 'van', 'HAL-001', 900)$q$, 'plate numbers are unique');

select pg_temp.expect_error($q$select public.submit_carrier_for_review()$q$, 'cannot submit without documents');
select pg_temp.expect_error(format($q$insert into public.carrier_documents (carrier_id, doc_type, storage_path, file_name, mime_type, size_bytes) values (auth.uid(), 'driver_license', %L, 'l.jpg', 'image/jpeg', 1000)$q$, '40000000-0000-0000-0000-00000000000d/' || gen_random_uuid() || '.jpg'), 'document path must be in own folder');
select pg_temp.expect_error($q$insert into public.carrier_documents (carrier_id, doc_type, storage_path, file_name, mime_type, size_bytes) values (auth.uid(), 'driver_license', 'x.exe', 'x.exe', 'application/x-msdownload', 1000)$q$, 'only images/PDF documents');
insert into public.carrier_documents (carrier_id, doc_type, storage_path, file_name, mime_type, size_bytes)
values (auth.uid(), 'driver_license', auth.uid() || '/' || gen_random_uuid() || '.jpg', 'licence.jpg', 'image/jpeg', 120000);
select pg_temp.expect_error($q$select public.submit_carrier_for_review()$q$, 'cannot submit without ID or passport');
insert into public.carrier_documents (carrier_id, doc_type, storage_path, file_name, mime_type, size_bytes)
values (auth.uid(), 'national_id', auth.uid() || '/' || gen_random_uuid() || '.pdf', 'id.pdf', 'application/pdf', 220000);
insert into storage.objects (bucket_id, name) values ('carrier-documents', auth.uid() || '/' || gen_random_uuid() || '.jpg');
select pg_temp.check(true, 'carrier can upload into own private folder');
select pg_temp.expect_error($q$insert into storage.objects (bucket_id, name) values ('carrier-documents', '40000000-0000-0000-0000-00000000000d/a.jpg')$q$, 'carrier cannot upload into another carrier''s folder');
select pg_temp.expect_error($q$update public.carrier_documents set doc_type = 'passport'$q$, 'documents are immutable');
select public.submit_carrier_for_review();
select pg_temp.check((select verification_status = 'under_review' and submitted_at is not null from public.carrier_profiles where id = auth.uid()), 'submitted for review');
select pg_temp.expect_error($q$select public.submit_carrier_for_review()$q$, 'cannot resubmit while under review');
select pg_temp.expect_error($q$select public.admin_review_carrier(auth.uid(), 'verified')$q$, 'carrier cannot approve themselves');
commit;

select pg_temp.check((select public from storage.buckets where id = 'carrier-documents') = false, 'document bucket is private');

-- ---------- privacy between carriers, buyers, sellers ---------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) = 1 from public.carrier_profiles), 'carrier sees only own profile');
select pg_temp.check((select count(*) = 0 from public.carrier_documents where carrier_id = '40000000-0000-0000-0000-00000000000c'), 'carrier cannot see another carrier''s documents');
select pg_temp.check((select count(*) = 0 from public.vehicles where carrier_id = '40000000-0000-0000-0000-00000000000c'), 'carrier cannot see another carrier''s vehicles');
select pg_temp.check((select count(*) = 0 from storage.objects where bucket_id = 'carrier-documents' and name like '40000000-0000-0000-0000-00000000000c/%'), 'carrier cannot list another carrier''s files');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 0 from public.carrier_profiles) and (select count(*) = 0 from public.carrier_documents), 'buyer cannot read carrier profiles or documents');
select pg_temp.check((select count(*) = 0 from storage.objects where bucket_id = 'carrier-documents'), 'buyer cannot see private files');
commit;
begin;
set local role anon;
select pg_temp.expect_error($q$select count(*) from public.carrier_documents$q$, 'anon cannot touch carrier documents');
select pg_temp.expect_error($q$select count(*) from public.freight_rfqs$q$, 'anon cannot read freight requests');
commit;

-- ---------- admin review ----------------------------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000009');
select pg_temp.check((select count(*) = 2 from public.carrier_documents where carrier_id = '40000000-0000-0000-0000-00000000000c'), 'admin sees carrier documents');
select pg_temp.check((select count(*) >= 1 from storage.objects where bucket_id = 'carrier-documents' and name like '40000000-0000-0000-0000-00000000000c/%'), 'admin can read private files (for signed URLs)');
select pg_temp.expect_error($q$select public.admin_review_carrier('40000000-0000-0000-0000-00000000000c', 'verified')$q$, 'cannot verify a carrier with no verified vehicle');
select pg_temp.expect_error($q$select public.admin_review_carrier('40000000-0000-0000-0000-00000000000c', 'rejected')$q$, 'rejection needs a reason');
select public.admin_set_vehicle_verified((select v from ids where k = 'cal_truck'), true);
select public.admin_review_carrier('40000000-0000-0000-0000-00000000000c', 'verified', 'Licence and ID checked in person');
select pg_temp.check((select verification_status = 'verified' and verified_at is not null and reviewed_by = auth.uid() from public.carrier_profiles where id = '40000000-0000-0000-0000-00000000000c'), 'admin verifies carrier');
select pg_temp.expect_error($q$select public.admin_review_carrier('40000000-0000-0000-0000-00000000000f', 'verified')$q$, 'pending carrier must submit before verification');
commit;
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'carrier.verified' and entity_id = '40000000-0000-0000-0000-00000000000c')
                     and (select count(*) = 1 from public.audit_logs where action = 'vehicle.verified'), 'verification decisions are audited');

begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$select public.admin_set_vehicle_verified((select v from ids where k = 'cal_truck'), true)$q$, 'non-admin cannot verify vehicles');
select pg_temp.expect_error($q$delete from public.carrier_documents$q$, 'verified carrier''s documents are kept on file');
update public.vehicles set payload_kg = 6000 where id = (select v from ids where k = 'cal_truck');
select pg_temp.check((select not is_verified from public.vehicles where id = (select v from ids where k = 'cal_truck')), 'changing payload needs re-verification');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000009');
select public.admin_set_vehicle_verified((select v from ids where k = 'cal_truck'), true);
commit;

-- ---------- freight request ---------------------------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.create_freight_rfq((select v from ids where k = 'order1'), current_date)$q$, 'no freight request before the order is ready');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select public.transition_order((select v from ids where k = 'order1'), 'fulfilling');
select public.transition_order((select v from ids where k = 'order1'), 'ready_for_freight');
select public.transition_order((select v from ids where k = 'order2'), 'fulfilling');
select public.transition_order((select v from ids where k = 'order2'), 'ready_for_freight');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$select public.create_freight_rfq((select v from ids where k = 'order1'), current_date)$q$, 'carrier cannot create a freight request');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.create_freight_rfq((select v from ids where k = 'order1'), current_date - 1)$q$, 'pickup date cannot be in the past');
select pg_temp.expect_error($q$select public.create_freight_rfq((select v from ids where k = 'order1'), current_date + 3, current_date + 1)$q$, 'delivery cannot be before pickup');
insert into ids select 'rfq1', public.create_freight_rfq((select v from ids where k = 'order1'), current_date + 1, current_date + 3, null, 'Call before arriving');
select pg_temp.check((select rfq_number ~ '^FR-[0-9]{4}-[0-9]{6}$' and status = 'open' and cargo_weight_g = 2500000 and cargo_volume_cm3 = 3000000
                        and required_class = 'medium' and package_count = 100 and pickup_county = 'Montserrado' and destination_county = 'Bong'
                        and destination_town = 'Gbarnga' and closes_at between now() + interval '47 hours' and now() + interval '49 hours'
                        from public.freight_rfqs where id = (select v from ids where k = 'rfq1')), 'RFQ cargo, route, class and bidding window computed');
select pg_temp.check((select status = 'freight_requested' from public.orders where id = (select v from ids where k = 'order1')), 'order moves to freight requested');
select pg_temp.expect_error($q$select public.create_freight_rfq((select v from ids where k = 'order1'), current_date + 1)$q$, 'only one live freight request per order');
commit;
select pg_temp.check(not exists (select 1 from information_schema.columns where table_name = 'freight_rfqs' and column_name in ('buyer_phone', 'contact_phone', 'contact_name')), 'RFQ rows carry no contact details');

-- ---------- who sees the load --------------------------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 1 from public.freight_rfqs), 'eligible verified carrier sees the load');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 0 from public.freight_rfqs), 'carrier without route coverage does not see it');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) = 0 from public.freight_rfqs), 'carrier whose vehicle is too small does not see it');
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, %L, 5000, 12, current_date + 2)$q$, (select v from ids where k = 'rfq1'), (select v from ids where k = 'eve_bike')), 'too-small carrier cannot bid');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000f');
select pg_temp.check((select count(*) = 0 from public.freight_rfqs), 'unverified carrier does not see it');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
-- Sam sees it as the seller, but may not bid on his own order as a carrier.
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, (select id from public.vehicles where plate_number = 'SAM-001'), 5000, 12, current_date + 2)$q$, (select v from ids where k = 'rfq1')), 'party to the order cannot bid on it');
select pg_temp.check((select count(*) = 0 from public.freight_bids), 'seller cannot see bids');
commit;

-- ---------- sealed bidding ------------------------------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, %L, 5000, 12, current_date + 2)$q$, (select v from ids where k = 'rfq1'), (select v from ids where k = 'hal_truck')), 'cannot bid with someone else''s vehicle');
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, %L, 5000, 12, current_date)$q$, (select v from ids where k = 'rfq1'), (select v from ids where k = 'cal_truck')), 'delivery date cannot be before pickup');
select pg_temp.expect_error(format($q$insert into public.freight_bids (rfq_id, carrier_id, vehicle_id, amount_minor, currency, eta_hours, proposed_delivery_date, carrier_name, vehicle_type, vehicle_class, payload_kg) values (%L, auth.uid(), %L, 1, 'USD', 1, current_date, 'x', 'van', 'small', 1)$q$, (select v from ids where k = 'rfq1'), (select v from ids where k = 'cal_truck')), 'bids cannot be inserted directly');
insert into ids select 'cal_bid', public.submit_freight_bid((select v from ids where k = 'rfq1'), (select v from ids where k = 'cal_truck'), 18000, 10, current_date + 2, 'Can load at 7am');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
insert into ids select 'hal_bid', public.submit_freight_bid((select v from ids where k = 'rfq1'), (select v from ids where k = 'hal_truck'), 15000, 14, current_date + 3);
select pg_temp.check((select count(*) = 1 from public.freight_bids), 'carrier sees only own bid');
select pg_temp.check((select count(*) = 0 from public.freight_bids where id = (select v from ids where k = 'cal_bid')), 'competitor bid invisible even by id');
select pg_temp.expect_error($q$update public.freight_bids set amount_minor = 1$q$, 'bids cannot be edited directly');
select pg_temp.expect_error(format($q$select public.withdraw_freight_bid(%L)$q$, (select v from ids where k = 'cal_bid')), 'cannot withdraw a competitor''s bid');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select public.withdraw_freight_bid((select v from ids where k = 'cal_bid'));
select pg_temp.check((select status = 'withdrawn' from public.freight_bids where id = (select v from ids where k = 'cal_bid')), 'carrier withdraws own bid');
select pg_temp.check(public.submit_freight_bid((select v from ids where k = 'rfq1'), (select v from ids where k = 'cal_truck'), 16000, 10, current_date + 2) = (select v from ids where k = 'cal_bid'), 'resubmitting revises the same bid');
select pg_temp.check((select status = 'submitted' and amount_minor = 16000 and carrier_name = 'Cal Cargo' and vehicle_class = 'large' from public.freight_bids where id = (select v from ids where k = 'cal_bid')), 'revised bid carries vehicle snapshot');
commit;

begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 2 from public.freight_bids), 'buyer sees all bids on their request');
select pg_temp.check((select count(*) = 0 from public.carrier_assignments), 'no assignment before selection');
commit;

-- ---------- carrier selection -----------------------------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$select public.select_freight_bid(%L)$q$, (select v from ids where k = 'cal_bid')), 'carrier cannot award the job to themselves');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$select public.select_freight_bid(%L)$q$, (select v from ids where k = 'hal_bid')), 'seller cannot choose the carrier');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.select_freight_bid(%L, 1)$q$, (select v from ids where k = 'hal_bid')), 'stale order version rejected');
select public.select_freight_bid((select v from ids where k = 'hal_bid'));
select pg_temp.check((select status = 'carrier_selected' and freight_minor = 15000 and total_minor = subtotal_minor + 15000 from public.orders where id = (select v from ids where k = 'order1')), 'freight added to the order total');
select pg_temp.check((select status = 'awarded' and awarded_bid_id = (select v from ids where k = 'hal_bid') from public.freight_rfqs where id = (select v from ids where k = 'rfq1')), 'RFQ awarded');
select pg_temp.check((select array_agg(status::text order by amount_minor) = array['accepted', 'rejected'] from public.freight_bids), 'winning bid accepted, others rejected (kept)');
select pg_temp.check((select revision = 2 and (snapshot->>'freight_minor')::bigint = 15000 and snapshot->'carrier'->>'name' = 'Hal Transport' and snapshot->>'estimated_delivery' is not null
                        from public.proforma_invoices where order_id = (select v from ids where k = 'order1') order by revision desc limit 1), 'invoice revision 2 includes carrier and freight');
select pg_temp.expect_error(format($q$select public.select_freight_bid(%L)$q$, (select v from ids where k = 'cal_bid')), 'cannot select a second carrier');
commit;

begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) = 1 and bool_and(pickup_snapshot->>'phone' = '+231770400001' and dropoff_snapshot->>'contact_phone' = '+231770400002') from public.carrier_assignments), 'winning carrier gets pickup and drop-off contacts');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 0 from public.carrier_assignments), 'losing carrier sees no assignment or contacts');
select pg_temp.check((select status = 'rejected' from public.freight_bids where id = (select v from ids where k = 'cal_bid')), 'losing carrier sees own bid was not chosen');
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, %L, 1000, 10, current_date + 2)$q$, (select v from ids where k = 'rfq1'), (select v from ids where k = 'cal_truck')), 'no bidding after award');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 1 from public.carrier_assignments), 'seller sees the assignment');
select public.transition_order((select v from ids where k = 'order1'), 'cancelled', 'Buyer asked to cancel by phone');
commit;
select pg_temp.check((select status = 'cancelled' from public.carrier_assignments where rfq_id = (select v from ids where k = 'rfq1'))
                     and (select quantity_available = 480 from public.products where id = (select v from ids where k = 'rice')), 'cancelling after selection cancels the assignment and restores stock');

-- ---------- cancel a request; suspension closes bids -------------------------------------
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000a');
insert into ids select 'rfq2', public.create_freight_rfq((select v from ids where k = 'order2'), current_date + 1);
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
insert into ids select 'hal_bid2', public.submit_freight_bid((select v from ids where k = 'rfq2'), (select v from ids where k = 'hal_truck'), 4000, 8, current_date + 1);
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000009');
select pg_temp.expect_error($q$select public.admin_review_carrier('40000000-0000-0000-0000-000000000001', 'suspended')$q$, 'suspension needs a reason');
select public.admin_review_carrier('40000000-0000-0000-0000-000000000001', 'suspended', 'Licence expired');
select pg_temp.check((select count(*) >= 1 from public.freight_bids) , 'admin sees all bids');
commit;
select pg_temp.check((select status = 'withdrawn' from public.freight_bids where id = (select v from ids where k = 'hal_bid2')), 'suspending a carrier withdraws their live bids');
begin;
select pg_temp.as_user('40000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) = 1 from public.freight_rfqs where id = (select v from ids where k = 'rfq2')), 'carrier still sees loads they bid on');
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, %L, 3000, 8, current_date + 1)$q$, (select v from ids where k = 'rfq2'), (select v from ids where k = 'hal_truck')), 'suspended carrier cannot bid');
commit;
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.select_freight_bid(%L)$q$, (select v from ids where k = 'hal_bid2')), 'withdrawn bid cannot be selected');
select public.cancel_freight_rfq((select v from ids where k = 'rfq2'), 'Will collect myself');
select pg_temp.check((select status = 'cancelled' from public.freight_rfqs where id = (select v from ids where k = 'rfq2'))
                     and (select status = 'ready_for_freight' from public.orders where id = (select v from ids where k = 'order2')), 'cancelled request returns order to ready for pickup');
insert into ids select 'rfq3', public.create_freight_rfq((select v from ids where k = 'order2'), current_date + 2);
select pg_temp.check((select count(*) = 1 from public.freight_rfqs where order_id = (select v from ids where k = 'order2') and status = 'open'), 'a new request can follow a cancelled one');
commit;

-- ---------- bidding window --------------------------------------------------------------
update public.freight_rfqs set closes_at = now() - interval '1 minute' where id = (select v from ids where k = 'rfq3');
begin;
select pg_temp.as_user('40000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 0 from public.freight_rfqs where id = (select v from ids where k = 'rfq3')), 'closed load leaves the board');
select pg_temp.expect_error(format($q$select public.submit_freight_bid(%L, %L, 3000, 8, current_date + 3)$q$, (select v from ids where k = 'rfq3'), (select v from ids where k = 'cal_truck')), 'no bids after the window closes');
commit;

\echo 'ALL PHASE 4 FREIGHT TESTS PASSED'

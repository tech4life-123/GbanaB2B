-- ============================================================================
-- Phase 5 financial engine: payments, escrow, ledger, payouts, refunds, rates.
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

-- Sam seller · Bea buyer · Zed other buyer · Cal carrier · Ada admin
insert into auth.users (id, phone) values
  ('50000000-0000-0000-0000-00000000000a', '231770500001'), ('50000000-0000-0000-0000-00000000000b', '231770500002'),
  ('50000000-0000-0000-0000-00000000000c', '231770500003'), ('50000000-0000-0000-0000-00000000000d', '231770500004'),
  ('50000000-0000-0000-0000-000000000009', '231770500009');
insert into public.user_roles (user_id, role) values
  ('50000000-0000-0000-0000-00000000000a', 'seller'), ('50000000-0000-0000-0000-00000000000b', 'buyer'),
  ('50000000-0000-0000-0000-00000000000c', 'carrier'), ('50000000-0000-0000-0000-00000000000d', 'buyer'),
  ('50000000-0000-0000-0000-000000000009', 'admin');
update public.platform_settings set value = '250' where key = 'commerce.platform_fee_bps';
update public.platform_settings set value = '48' where key = 'freight.bid_expiry_hours';

insert into public.carrier_profiles (id, full_name, phone, address, home_county, home_town, coverage_counties, verification_status, verified_at)
values ('50000000-0000-0000-0000-00000000000c', 'Cal Cargo', '+231770500003', 'Duala', 'Montserrado', 'Monrovia', array['Montserrado', 'Bong'], 'verified', now());
insert into public.vehicles (carrier_id, vehicle_type, plate_number, payload_kg, is_verified)
values ('50000000-0000-0000-0000-00000000000c', 'box_truck', 'CAL-501', 8000, true);
update public.vehicles set is_verified = true where plate_number = 'CAL-501';

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
insert into ids select 'biz', public.create_business('Sam Supply 5', 'wholesaler', 'Montserrado', 'Waterside', null, '+231770500001');
insert into public.products (business_id, category_id, title, unit_label, packaging_type, moq, quantity_available, unit_weight_g, unit_volume_cm3, is_fragile)
select (select v from ids where k = 'biz'), (select id from public.product_categories limit 1), 'Sam rice P5', '25 kg bag', 'bag', 10, 500, 25000, 30000, false;
insert into ids select 'rice', id from public.products where title = 'Sam rice P5';
select public.save_product_pricing((select v from ids where k = 'rice'), 10, 'USD', '[{"min_qty":10,"max_qty":null,"unit_price_minor":2400}]');
update public.products set status = 'active' where id = (select v from ids where k = 'rice');
commit;

-- Four orders of 10 bags: 24000 subtotal, 600 fee, 5000 freight → 29000 total.
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
insert into public.addresses (profile_id, label, contact_name, contact_phone, county, town)
values (auth.uid(), 'Store', 'Bea Buyer', '+231770500002', 'Bong', 'Gbarnga');
do $$ declare i integer; oid uuid; begin
  for i in 1..4 loop
    insert into public.cart_items (profile_id, product_id, quantity) values (auth.uid(), (select v from ids where k = 'rice'), 10);
    oid := (public.place_orders((select id from public.addresses limit 1)))[1];
    insert into ids values ('o' || i, oid);
  end loop;
end $$;
commit;

begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
do $$ declare i integer; begin
  for i in 1..4 loop
    perform public.transition_order((select v from ids where k = 'o' || i), 'confirmed');
    perform public.transition_order((select v from ids where k = 'o' || i), 'fulfilling');
    perform public.transition_order((select v from ids where k = 'o' || i), 'ready_for_freight');
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..4 loop
    insert into ids values ('r' || i, public.create_freight_rfq((select v from ids where k = 'o' || i), current_date + 1));
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000c');
do $$ declare i integer; begin
  for i in 1..4 loop
    insert into ids values ('b' || i, public.submit_freight_bid((select v from ids where k = 'r' || i), (select id from public.vehicles where plate_number = 'CAL-501'), 5000, 10, current_date + 2));
  end loop;
end $$;
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
do $$ declare i integer; begin
  for i in 1..4 loop perform public.select_freight_bid((select v from ids where k = 'b' || i)); end loop;
end $$;
select pg_temp.check((select bool_and(status = 'carrier_selected' and total_minor = 29000 and platform_fee_minor = 600) from public.orders where id in (select v from ids where k like 'o_')), 'fixtures: four orders with carrier booked, total 29000');
commit;

-- ---------- starting a payment -------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '+231770500099', 'idem-zed-0001')$q$, (select v from ids where k = 'o1')), 'another buyer cannot pay for the order');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'mtn_momo_lr', '+231770500002', 'idem-bea-mtn-1')$q$, (select v from ids where k = 'o1')), 'MTN is off until the verified adapter is live');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '0770500002', 'idem-bea-bad-1')$q$, (select v from ids where k = 'o1')), 'phone number must be international format');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '+231770500002', 'short')$q$, (select v from ids where k = 'o1')), 'payment reference too short is refused');
select pg_temp.expect_error($q$insert into public.payment_transactions (intent_id, order_id, provider, idempotency_key, amount_minor, currency, payer_msisdn) select id, order_id, 'sandbox', 'hack-insert-1', 1, 'USD', '+231770500002' from public.payment_intents$q$, 'buyer cannot insert payment rows');
select pg_temp.expect_error($q$select public.apply_provider_event('sandbox', 'e-hack', gen_random_uuid(), 'x', 'succeeded', 1, 'USD', '{}')$q$, 'buyer cannot fake a provider webhook');
select pg_temp.expect_error($q$select public.record_payment_attempt(gen_random_uuid(), 'x', 'pending')$q$, 'buyer cannot record provider responses');
insert into ids select 't1', public.start_payment((select v from ids where k = 'o1'), 'sandbox', '+231770500002', 'idem-bea-o1-0001');
select pg_temp.check((select status = 'awaiting_payment' from public.orders where id = (select v from ids where k = 'o1')), 'order moves to awaiting payment');
select pg_temp.check(public.start_payment((select v from ids where k = 'o1'), 'sandbox', '+231770500002', 'idem-bea-o1-0001') = (select v from ids where k = 't1'), 'same idempotency key returns the same attempt');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '+231770500002', 'idem-bea-o1-0002')$q$, (select v from ids where k = 'o1')), 'a second attempt while one is waiting is refused');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '+231770500002', 'idem-bea-o5-0001')$q$, (select v from ids where k = 'r1')), 'unknown order is refused');
select pg_temp.check((select amount_minor = 29000 and currency = 'USD' and status = 'initiated' from public.payment_transactions where id = (select v from ids where k = 't1')), 'attempt holds the full order total');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '+231770500099', 'idem-bea-o1-0001')$q$, (select v from ids where k = 'o1')), 'cannot reuse another buyer''s payment reference');
commit;

-- ---------- provider events (service role) ---------------------------------------
begin;
set local role service_role;
select public.record_payment_attempt((select v from ids where k = 't1'), 'SBX-1', 'pending');
select pg_temp.check((select status = 'pending' and provider_txn_id = 'SBX-1' from public.payment_transactions where id = (select v from ids where k = 't1')), 'provider accepted the request → pending');
select pg_temp.check((select status <> 'paid_escrow' from public.orders where id = (select v from ids where k = 'o1')), 'nothing is paid just because the request was sent');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-unknown', gen_random_uuid(), null, 'succeeded', 29000, 'USD', '{}') = 'unknown_reference', 'webhook for an unknown reference is parked, not applied');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-wrongamt', (select v from ids where k = 't1'), 'SBX-1', 'succeeded', 100, 'USD', '{}') = 'amount_mismatch', 'wrong amount is not applied');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-wrongcur', (select v from ids where k = 't1'), 'SBX-1', 'succeeded', 29000, 'LRD', '{}') = 'amount_mismatch', 'wrong currency is not applied');
select pg_temp.check(public.apply_provider_event('mtn_momo_lr', 'evt-wrongprov', (select v from ids where k = 't1'), 'SBX-1', 'succeeded', 29000, 'USD', '{}') = 'unknown_reference', 'wrong provider is not applied');
select pg_temp.check((select status = 'awaiting_payment' from public.orders where id = (select v from ids where k = 'o1')), 'bad events left the order untouched');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-ok-1', (select v from ids where k = 't1'), 'SBX-1', 'succeeded', 29000, 'USD', '{"x":1}') = 'applied', 'verified success funds escrow');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-ok-1', (select v from ids where k = 't1'), 'SBX-1', 'succeeded', 29000, 'USD', '{"x":1}') = 'duplicate_event', 'duplicate webhook is a no-op');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-ok-2', (select v from ids where k = 't1'), 'SBX-1', 'succeeded', 29000, 'USD', '{}') = 'already_applied', 'same payment, new event id, still applied once');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-fail-late', (select v from ids where k = 't1'), 'SBX-1', 'failed', null, null, '{}') = 'conflict_already_succeeded', 'a failure after success is flagged, not applied');
select pg_temp.check((select count(*) = 1 from public.escrow_accounts where order_id = (select v from ids where k = 'o1')), 'exactly one escrow account');
select pg_temp.check((select status = 'paid_escrow' from public.orders where id = (select v from ids where k = 'o1')), 'order is paid into escrow');
select pg_temp.check((select amount_minor = 29000 and fee_minor = 600 and seller_net_minor = 23400 and carrier_net_minor = 5000 and status = 'held'
                        from public.escrow_accounts where order_id = (select v from ids where k = 'o1')), 'escrow shares: fee 600, seller 23400, carrier 5000');
select pg_temp.check((select count(*) = 7 from public.provider_events), 'each distinct verified event recorded once (the replay was not stored again)');
select pg_temp.expect_error($q$update public.provider_events set payload = '{}'$q$, 'provider event payloads cannot be rewritten');
select pg_temp.expect_error($q$delete from public.provider_events$q$, 'provider events cannot be deleted');
commit;
select pg_temp.check((select count(*) >= 3 from public.audit_logs where action = 'payment.event_needs_review'), 'anomalies are audited');
select pg_temp.check((select balance_minor = 29000 from public.ledger_balances where account = 'escrow' and currency = 'USD'), 'ledger: escrow holds 29000');
select pg_temp.check((select sum(case direction when 'debit' then amount_minor else -amount_minor end) = 0 from public.ledger_entries), 'ledger balances to zero');

-- ---------- failure and retry --------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
insert into ids select 't2', public.start_payment((select v from ids where k = 'o2'), 'sandbox', '+231770500002', 'idem-bea-o2-0001');
commit;
begin;
set local role service_role;
select public.record_payment_attempt((select v from ids where k = 't2'), 'SBX-2', 'pending');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-o2-pending', (select v from ids where k = 't2'), 'SBX-2', 'pending', null, null, '{}') = 'applied', 'pending event accepted');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-o2-fail', (select v from ids where k = 't2'), 'SBX-2', 'failed', 29000, 'USD', '{"reason":"Insufficient funds"}') = 'applied', 'failed payment recorded');
select pg_temp.check((select status = 'failed' and failure_reason = 'Insufficient funds' from public.payment_transactions where id = (select v from ids where k = 't2')), 'failure reason kept');
select pg_temp.check((select status = 'awaiting_payment' from public.orders where id = (select v from ids where k = 'o2')), 'failed payment leaves the order awaiting payment');
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-o2-pending2', (select v from ids where k = 't2'), 'SBX-2', 'pending', null, null, '{}') = 'ignored_stale', 'out-of-order pending after failure is ignored');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
insert into ids select 't3', public.start_payment((select v from ids where k = 'o2'), 'sandbox', '+231770500002', 'idem-bea-o2-0002');
select pg_temp.check((select t3.id <> t2.id from (select v as id from ids where k = 't3') t3, (select v as id from ids where k = 't2') t2), 'buyer can retry after a failure with a new attempt');
commit;
begin;
set local role service_role;
-- A provider that cannot even accept the request:
select public.record_payment_attempt((select v from ids where k = 't3'), null, 'failed', 'Provider unavailable');
select pg_temp.check((select status = 'failed' from public.payment_transactions where id = (select v from ids where k = 't3')), 'provider rejection marks the attempt failed');
commit;

-- ---------- timeout, then a delayed success ---------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
insert into ids select 't4', public.start_payment((select v from ids where k = 'o2'), 'sandbox', '+231770500002', 'idem-bea-o2-0003');
commit;
update public.payment_intents set expires_at = now() - interval '1 minute' where order_id = (select v from ids where k = 'o2') and status = 'processing';
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
insert into ids select 't5', public.start_payment((select v from ids where k = 'o2'), 'sandbox', '+231770500002', 'idem-bea-o2-0004');
select pg_temp.check((select status = 'expired' from public.payment_transactions where id = (select v from ids where k = 't4')), 'the timed-out attempt is expired when the buyer retries');
commit;
begin;
set local role service_role;
select public.record_payment_attempt((select v from ids where k = 't5'), 'SBX-5', 'pending');
-- The provider finally confirms the OLD, expired attempt while the new one is open.
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-o2-late', (select v from ids where k = 't4'), 'SBX-4', 'succeeded', 29000, 'USD', '{}') = 'orphan_success', 'delayed success on an expired attempt cannot silently fund escrow twice');
commit;
select pg_temp.check((select count(*) = 1 from public.ledger_entries where kind = 'payment_unapplied' and account = 'unapplied_funds'), 'the unmatched money is parked in unapplied funds for an admin');
-- The current attempt still succeeds normally.
begin;
set local role service_role;
select pg_temp.check(public.apply_provider_event('sandbox', 'evt-o2-ok', (select v from ids where k = 't5'), 'SBX-5', 'succeeded', 29000, 'USD', '{}') = 'applied', 'current attempt still funds escrow');
commit;

-- ---------- who can see what -------------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) >= 1 from public.payment_transactions) and (select count(*) = 2 from public.escrow_accounts), 'buyer sees own payments and escrow');
select pg_temp.check((select count(*) = 0 from public.ledger_entries) and (select count(*) = 0 from public.provider_events), 'buyer cannot read the ledger or provider events');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) = 0 from public.payment_transactions) and (select count(*) = 0 from public.escrow_accounts) and (select count(*) = 0 from public.payment_intents), 'other buyer sees no payments');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 2 from public.escrow_accounts), 'seller sees escrow on own orders');
select pg_temp.check((select count(*) = 0 from public.payment_transactions), 'seller cannot see the buyer''s phone or payment attempts');
commit;
begin;
set local role anon;
select pg_temp.expect_error($q$select count(*) from public.escrow_accounts$q$, 'anon cannot read escrow');
select pg_temp.expect_error($q$select count(*) from public.ledger_entries$q$, 'anon cannot read the ledger');
commit;

-- ---------- releasing escrow ------------------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.admin_release_escrow(%L, 'please')$q$, (select v from ids where k = 'o1')), 'buyer cannot release escrow');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$select public.admin_release_escrow(%L, 'please')$q$, (select v from ids where k = 'o1')), 'seller cannot release their own escrow');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-000000000009');
select pg_temp.expect_error(format($q$select public.admin_release_escrow(%L, '')$q$, (select v from ids where k = 'o1')), 'release needs a reason');
select pg_temp.expect_error(format($q$select public.admin_release_escrow(%L, 'no funds here')$q$, (select v from ids where k = 'o3')), 'nothing to release without funded escrow');
select pg_temp.check(public.admin_release_escrow((select v from ids where k = 'o1'), 'Buyer confirmed receipt by phone'), 'admin releases escrow');
select pg_temp.check(public.admin_release_escrow((select v from ids where k = 'o1'), 'Buyer confirmed receipt by phone') = false, 'releasing twice does nothing');
select pg_temp.check((select status = 'released' from public.escrow_accounts where order_id = (select v from ids where k = 'o1')), 'escrow marked released');
select pg_temp.check((select status = 'completed' from public.orders where id = (select v from ids where k = 'o1')), 'order completed');
select pg_temp.check((select count(*) = 2 and sum(amount_minor) = 28400 from public.payouts where order_id = (select v from ids where k = 'o1')), 'two payouts created: seller 23400 + carrier 5000');
select pg_temp.check((select balance_minor = 600 from public.ledger_balances where account = 'platform_fees' and currency = 'USD'), 'platform fee 600 recognised');
select pg_temp.expect_error(format($q$select public.admin_refund_escrow(%L, 'too late')$q$, (select v from ids where k = 'o1')), 'released funds cannot be refunded');
commit;
select pg_temp.check((select count(*) = 1 from public.audit_logs where action = 'escrow.released' and entity_id = (select v::text from ids where k = 'o1')), 'release is audited');
select pg_temp.check((select count(*) = 4 from public.ledger_entries where kind = 'escrow_released'), 'release wrote one balanced group of four entries');

-- ---------- payouts ---------------------------------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) = 1 and bool_and(recipient = 'seller') from public.payouts), 'seller sees only their own payout');
select pg_temp.expect_error($q$update public.payouts set status = 'paid'$q$, 'seller cannot mark payouts paid');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) = 1 and bool_and(recipient = 'carrier') from public.payouts), 'carrier sees only their own payout');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-000000000009');
insert into ids select 'p_seller', id from public.payouts where recipient = 'seller' and order_id = (select v from ids where k = 'o1');
select pg_temp.expect_error(format($q$select public.admin_begin_payout(%L, 'mtn_momo_lr', '+231770500001')$q$, (select v from ids where k = 'p_seller')), 'cannot pay out through a disabled provider');
select pg_temp.expect_error(format($q$select public.admin_finish_payout(%L, true)$q$, (select v from ids where k = 'p_seller')), 'cannot finish a payout that was never started');
select pg_temp.check(public.admin_begin_payout((select v from ids where k = 'p_seller'), 'sandbox', '+231770500001'), 'payout started');
select pg_temp.check(public.admin_begin_payout((select v from ids where k = 'p_seller'), 'sandbox', '+231770500001') = false, 'starting twice does nothing');
select pg_temp.check(public.admin_finish_payout((select v from ids where k = 'p_seller'), false, null, 'Wallet closed'), 'failed payout recorded');
select pg_temp.check((select balance_minor = 23400 from public.ledger_balances where account = 'seller_payable' and currency = 'USD'), 'failed payout returns to payable');
select pg_temp.check(public.admin_begin_payout((select v from ids where k = 'p_seller'), 'sandbox', '+231770500001'), 'failed payout can be retried');
select pg_temp.check(public.admin_finish_payout((select v from ids where k = 'p_seller'), true, 'SBX-PAYOUT-1'), 'payout paid');
select pg_temp.check(public.admin_finish_payout((select v from ids where k = 'p_seller'), true, 'SBX-PAYOUT-1') = false, 'finishing twice does nothing');
select pg_temp.check((select status = 'paid' and attempts = 2 and provider_ref = 'SBX-PAYOUT-1' from public.payouts where id = (select v from ids where k = 'p_seller')), 'payout state and attempts recorded');
commit;
select pg_temp.check((select sum(case direction when 'debit' then amount_minor else -amount_minor end) = 0 from public.ledger_entries), 'ledger still balances after payouts');

-- ---------- refunds -------------------------------------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.admin_refund_escrow(%L, 'I want my money')$q$, (select v from ids where k = 'o2')), 'buyer cannot refund themselves');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-000000000009');
select pg_temp.expect_error(format($q$select public.admin_refund_escrow(%L, '')$q$, (select v from ids where k = 'o2')), 'refund needs a reason');
insert into ids select 'ref', public.admin_refund_escrow((select v from ids where k = 'o2'), 'Seller could not deliver');
select pg_temp.check(public.admin_refund_escrow((select v from ids where k = 'o2'), 'Seller could not deliver') = (select v from ids where k = 'ref'), 'refunding twice returns the same refund');
select pg_temp.check((select status = 'refunded' from public.orders where id = (select v from ids where k = 'o2')) and (select status = 'refunded' from public.escrow_accounts where order_id = (select v from ids where k = 'o2')), 'order and escrow are refunded');
select pg_temp.check((select amount_minor = 29000 and destination_msisdn = '+231770500002' and status = 'pending' from public.refunds where id = (select v from ids where k = 'ref')), 'refund goes back to the paying number');
select pg_temp.expect_error(format($q$select public.admin_release_escrow(%L, 'release anyway')$q$, (select v from ids where k = 'o2')), 'refunded escrow cannot be released');
select pg_temp.check(public.admin_mark_refund((select v from ids where k = 'ref'), true, 'SBX-REFUND-1'), 'refund marked paid');
select pg_temp.check(public.admin_mark_refund((select v from ids where k = 'ref'), true, 'SBX-REFUND-1') = false, 'marking twice does nothing');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 from public.refunds), 'buyer sees own refund');
commit;
select pg_temp.check((select sum(case direction when 'debit' then amount_minor else -amount_minor end) = 0 from public.ledger_entries), 'ledger balances after refund');
select pg_temp.check((select balance_minor = 0 from public.ledger_balances where account = 'refunds_payable' and currency = 'USD'), 'refund liability cleared once paid');

-- ---------- the ledger itself ----------------------------------------------------------------------------
begin;
set local role service_role;
select pg_temp.expect_error($q$update public.ledger_entries set amount_minor = 1$q$, 'ledger entries cannot be edited');
select pg_temp.expect_error($q$delete from public.ledger_entries$q$, 'ledger entries cannot be deleted');
select pg_temp.expect_error($q$truncate public.ledger_entries$q$, 'ledger cannot be truncated');
commit;
\echo (expected error below: unbalanced ledger group refused at commit)
\set ON_ERROR_STOP off
insert into public.ledger_entries (entry_group, account, direction, amount_minor, currency, kind) values (gen_random_uuid(), 'escrow', 'debit', 100, 'USD', 'manual_test');
\set ON_ERROR_STOP on
select pg_temp.check(not exists (select 1 from public.ledger_entries where kind = 'manual_test'), 'an unbalanced ledger group is refused at commit');

-- ---------- exchange rates -----------------------------------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($q$select public.set_exchange_rate('USD', 'LRD', 190)$q$, 'non-admin cannot set exchange rates');
select pg_temp.expect_error($q$insert into public.exchange_rates (base, quote, rate) values ('USD', 'LRD', 1)$q$, 'cannot write rates directly');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-000000000009');
select pg_temp.expect_error($q$select public.set_exchange_rate('USD', 'USD', 1)$q$, 'rate needs two different currencies');
select pg_temp.expect_error($q$select public.set_exchange_rate('USD', 'LRD', 0)$q$, 'rate must be positive');
select public.set_exchange_rate('USD', 'LRD', 190.5, 'Central bank mid-rate');
select public.set_exchange_rate('USD', 'LRD', 192, 'Updated');
select pg_temp.check((select count(*) = 2 from public.exchange_rates), 'rate changes keep history');
commit;
select pg_temp.check((select count(*) = 2 from public.audit_logs where action = 'exchange_rate.changed'), 'exchange rate changes are audited');
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
insert into ids select 't6', public.start_payment((select v from ids where k = 'o3'), 'sandbox', '+231770500002', 'idem-bea-o3-0001');
select pg_temp.check((select fx_usd_lrd = 192 from public.payment_intents where order_id = (select v from ids where k = 'o3')), 'payment remembers the exchange rate it saw');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-000000000009');
select public.set_exchange_rate('USD', 'LRD', 200);
commit;
select pg_temp.check((select fx_usd_lrd = 192 from public.payment_intents where order_id = (select v from ids where k = 'o3')), 'later rate changes do not rewrite old payments');

-- ---------- settings ----------------------------------------------------------------------------------------------
begin;
select pg_temp.as_user('50000000-0000-0000-0000-000000000009');
select public.update_platform_setting('payments.sandbox_enabled', '0');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error(format($q$select public.start_payment(%L, 'sandbox', '+231770500002', 'idem-bea-o4-0001')$q$, (select v from ids where k = 'o4')), 'test provider can be switched off for production');
commit;
begin;
select pg_temp.as_user('50000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) = 1 from public.payment_intents where order_id = (select v from ids where k = 'o3')), 'fixtures stable');
commit;

\echo ALL PHASE 5 PAYMENT TESTS PASSED

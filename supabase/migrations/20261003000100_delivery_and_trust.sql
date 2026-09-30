-- ============================================================================
-- GbanaB2B · Phase 6 · Delivery & trust
-- Delivery lifecycle (pickup → checkpoints → arrival → confirmation), the
-- secure delivery code that releases escrow, disputes with private evidence,
-- partial refunds, reviews and trust counters, and expiry of unpaid orders.
-- Every state change goes through a SECURITY DEFINER workflow; clients read
-- what RLS allows and write nothing directly. Money only moves through the
-- Phase 5 ledger helpers. See docs/database/delivery-and-trust.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description, is_sensitive, min_value, max_value) values
  ('delivery.code_max_attempts', '5', 'Wrong delivery-code entries allowed before the code locks (the buyer can then issue a new one).', false, 3, 20),
  ('delivery.auto_confirm_hours', '72', 'Hours after the carrier reports arrival before funds are released automatically, if the buyer is silent and there is no dispute.', false, 12, 720),
  ('delivery.checkpoint_min_seconds', '120', 'Minimum seconds between location checkpoints from one carrier (keeps tracking light on battery and data).', false, 30, 3600),
  ('orders.payment_window_hours', '48', 'Hours a buyer has to pay after choosing a carrier before the order is cancelled automatically.', false, 1, 720),
  ('disputes.max_evidence_files', '12', 'Maximum evidence files per dispute.', false, 1, 50),
  ('reviews.window_days', '30', 'Days after completion during which a buyer can leave a review.', false, 1, 365)
on conflict (key) do nothing;

-- Carriers appear in the order history now.
alter table public.order_status_history drop constraint order_status_history_actor_role_check;
alter table public.order_status_history
  add constraint order_status_history_actor_role_check check (actor_role in ('buyer', 'seller', 'carrier', 'admin', 'system'));

-- Partial refunds keep the escrow shares as funded; the refund is recorded beside them.
alter table public.escrow_accounts add column refunded_minor bigint not null default 0 check (refunded_minor >= 0);

create type public.dispute_kind as enum (
  'missing_items', 'damaged_goods', 'incorrect_quantity', 'incorrect_product',
  'delivery_failure', 'payment_issue', 'carrier_issue', 'seller_issue'
);
create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'rejected', 'refunded', 'partial_refund');

-- ---------------------------------------------------------------------------
-- Who is who on an order (internal helpers used by policies and workflows)
-- ---------------------------------------------------------------------------
create or replace function public.order_carrier_id(p_order uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select ca.carrier_id from public.carrier_assignments ca
   where ca.order_id = p_order and ca.status in ('active', 'completed')
   order by ca.assigned_at desc limit 1
$$;

create or replace function public.is_order_carrier(p_order uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.order_carrier_id(p_order) = (select auth.uid())
$$;

-- 'buyer' | 'seller' | 'carrier' | null for the signed-in user on this order.
create or replace function public.order_party_role(p_order uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype;
begin
  if v_uid is null then return null; end if;
  select * into v_o from public.orders where id = p_order;
  if not found then return null; end if;
  if v_o.buyer_id = v_uid then return 'buyer'; end if;
  if public.is_business_member(v_o.seller_business_id) then return 'seller'; end if;
  if public.order_carrier_id(p_order) = v_uid then return 'carrier'; end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Trust counters — aggregates only, public by design. Maintained by triggers
-- and workflows below; nobody can write them directly.
-- ---------------------------------------------------------------------------
create table public.trust_stats (
  subject_kind          text not null check (subject_kind in ('seller', 'carrier')),
  subject_id            uuid not null,
  completed_orders      integer not null default 0 check (completed_orders >= 0),
  cancelled_by_subject  integer not null default 0 check (cancelled_by_subject >= 0),
  disputes_upheld       integer not null default 0 check (disputes_upheld >= 0),
  reviews_count         integer not null default 0 check (reviews_count >= 0),
  rating_sum            integer not null default 0 check (rating_sum >= 0),
  updated_at            timestamptz not null default now(),
  primary key (subject_kind, subject_id)
);
comment on table public.trust_stats is 'Public aggregates for seller/carrier trust. Only counts real completed orders and real reviews; there is no ranking boost and no editable score.';

create or replace function public.bump_trust(
  p_kind text, p_id uuid, p_completed integer default 0, p_cancelled integer default 0,
  p_upheld integer default 0, p_reviews integer default 0, p_rating integer default 0
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null then return; end if;
  insert into public.trust_stats (subject_kind, subject_id, completed_orders, cancelled_by_subject, disputes_upheld, reviews_count, rating_sum)
  values (p_kind, p_id, greatest(p_completed, 0), greatest(p_cancelled, 0), greatest(p_upheld, 0), greatest(p_reviews, 0), greatest(p_rating, 0))
  on conflict (subject_kind, subject_id) do update
     set completed_orders = greatest(public.trust_stats.completed_orders + p_completed, 0),
         cancelled_by_subject = greatest(public.trust_stats.cancelled_by_subject + p_cancelled, 0),
         disputes_upheld = greatest(public.trust_stats.disputes_upheld + p_upheld, 0),
         reviews_count = greatest(public.trust_stats.reviews_count + p_reviews, 0),
         rating_sum = greatest(public.trust_stats.rating_sum + p_rating, 0),
         updated_at = now();
end $$;

create or replace function public.orders_trust_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('completed', 'partially_refunded') and old.status not in ('completed', 'partially_refunded') then
      perform public.bump_trust('seller', new.seller_business_id, 1);
      perform public.bump_trust('carrier', public.order_carrier_id(new.id), 1);
    elsif new.status = 'cancelled' and new.cancelled_by = 'seller' then
      perform public.bump_trust('seller', new.seller_business_id, 0, 1);
    end if;
  end if;
  return null;
end $$;
create trigger orders_trust_stats after update of status on public.orders
  for each row execute function public.orders_trust_trigger();

-- ---------------------------------------------------------------------------
-- Delivery: state, events, and the buyer-only code
-- ---------------------------------------------------------------------------
create table public.order_deliveries (
  order_id            uuid primary key references public.orders (id) on delete restrict,
  carrier_id          uuid not null references public.carrier_profiles (id) on delete restrict,
  picked_up_at        timestamptz not null default now(),
  arrived_at          timestamptz,
  completed_at        timestamptz,
  confirmation_method text check (confirmation_method is null or confirmation_method in ('buyer_code', 'buyer', 'auto', 'admin')),
  created_at          timestamptz not null default now()
);
create index order_deliveries_carrier_idx on public.order_deliveries (carrier_id);
create index order_deliveries_arrival_idx on public.order_deliveries (arrived_at) where completed_at is null and arrived_at is not null;

create table public.delivery_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete restrict,
  kind        text not null check (kind in ('picked_up', 'checkpoint', 'arrived', 'delivery_failed', 'delivered')),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  text not null check (actor_role in ('buyer', 'seller', 'carrier', 'admin', 'system')),
  note        text check (note is null or char_length(note) <= 300),
  lat         numeric(8, 4) check (lat is null or lat between -90 and 90),
  lng         numeric(9, 4) check (lng is null or lng between -180 and 180),
  created_at  timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index delivery_events_order_idx on public.delivery_events (order_id, id);
create index delivery_events_actor_idx on public.delivery_events (actor_id) where actor_id is not null;
create trigger delivery_events_append_only before update or delete on public.delivery_events
  for each row execute function public.prevent_mutation();
comment on column public.delivery_events.lat is 'Only set when the carrier taps "share my location" at a checkpoint; rounded to ~10 m. There is no continuous GPS stream.';

-- The code is readable by the BUYER only (not the carrier, seller or admins).
create table public.delivery_codes (
  order_id       uuid primary key references public.orders (id) on delete restrict,
  code           text not null check (code ~ '^[0-9]{6}$'),
  attempts       integer not null default 0 check (attempts >= 0),
  locked         boolean not null default false,
  regenerated_at timestamptz,
  created_at     timestamptz not null default now()
);

create or replace function public.new_delivery_code()
returns text language plpgsql volatile set search_path = '' as $$
declare d bytea := decode(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 'hex');
begin
  return lpad((((get_byte(d, 0)::bigint * 16777216) + (get_byte(d, 1) * 65536) + (get_byte(d, 2) * 256) + get_byte(d, 3)) % 1000000)::text, 6, '0');
end $$;

-- ---------------------------------------------------------------------------
-- Internal money movers (the ONLY places escrow leaves 'held'). Callers have
-- already decided who may ask; these do the accounting, transactionally.
-- ---------------------------------------------------------------------------
create or replace function public.settle_escrow(p_order uuid, p_actor uuid, p_role text, p_method text, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_o public.orders%rowtype; v_e public.escrow_accounts%rowtype; v_carrier uuid;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  select * into v_e from public.escrow_accounts where order_id = p_order for update;
  if not found then raise exception 'No funds are held for this order' using errcode = 'check_violation'; end if;
  if v_e.status = 'released' then return false; end if;
  if v_e.status <> 'held' then raise exception 'These funds were already %', v_e.status using errcode = 'check_violation'; end if;
  if v_o.status not in ('paid_escrow', 'in_transit', 'delivered', 'awaiting_confirmation', 'disputed') then
    raise exception 'The order can''t release funds from "%"', replace(v_o.status::text, '_', ' ') using errcode = 'check_violation';
  end if;

  update public.escrow_accounts set status = 'released', released_at = now() where id = v_e.id;
  perform public.ledger_post(p_order, v_e.currency, 'escrow_released',
    jsonb_build_array(
      jsonb_build_object('account', 'escrow', 'direction', 'debit', 'amount', v_e.amount_minor),
      jsonb_build_object('account', 'platform_fees', 'direction', 'credit', 'amount', v_e.fee_minor),
      jsonb_build_object('account', 'seller_payable', 'direction', 'credit', 'amount', v_e.seller_net_minor),
      jsonb_build_object('account', 'carrier_payable', 'direction', 'credit', 'amount', v_e.carrier_net_minor)),
    null, null, null, left(p_note, 300));

  if v_e.seller_net_minor > 0 then
    insert into public.payouts (order_id, recipient, seller_business_id, amount_minor, currency)
    values (p_order, 'seller', v_o.seller_business_id, v_e.seller_net_minor, v_e.currency);
  end if;
  v_carrier := public.order_carrier_id(p_order);
  if v_e.carrier_net_minor > 0 and v_carrier is not null then
    insert into public.payouts (order_id, recipient, carrier_id, amount_minor, currency)
    values (p_order, 'carrier', v_carrier, v_e.carrier_net_minor, v_e.currency);
  end if;

  update public.carrier_assignments set status = 'completed' where order_id = p_order and status = 'active';
  update public.order_deliveries set completed_at = now(), confirmation_method = case when p_method in ('buyer_code', 'buyer', 'auto', 'admin') then p_method end
   where order_id = p_order and completed_at is null;

  if v_o.status in ('in_transit', 'awaiting_confirmation') then
    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (p_order, v_o.status, 'delivered', p_actor, p_role, left(p_note, 500));
    insert into public.delivery_events (order_id, kind, actor_id, actor_role, note)
    values (p_order, 'delivered', p_actor, p_role, left(p_note, 300));
    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (p_order, 'delivered', 'completed', p_actor, p_role, 'Funds released to seller and carrier');
  else
    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (p_order, v_o.status, 'completed', p_actor, p_role, left(p_note, 500));
  end if;
  update public.orders set status = 'completed', version = version + 1 where id = p_order;
  perform public.write_audit_log('escrow.released', 'order', p_order::text,
    jsonb_build_object('order_number', v_o.order_number, 'amount_minor', v_e.amount_minor, 'fee_minor', v_e.fee_minor, 'method', p_method, 'note', left(p_note, 300)));
  return true;
end $$;

create or replace function public.refund_escrow_full(p_order uuid, p_actor uuid, p_role text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_o public.orders%rowtype; v_e public.escrow_accounts%rowtype; v_msisdn text; v_refund uuid;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  select * into v_e from public.escrow_accounts where order_id = p_order for update;
  if not found then raise exception 'No funds are held for this order' using errcode = 'check_violation'; end if;
  if v_e.status = 'refunded' then
    select id into v_refund from public.refunds where order_id = p_order;
    return v_refund;
  end if;
  if v_e.status <> 'held' then raise exception 'These funds were already released' using errcode = 'check_violation'; end if;
  if v_o.status not in ('paid_escrow', 'in_transit', 'delivered', 'awaiting_confirmation', 'disputed') then
    raise exception 'The order can''t be refunded from "%"', replace(v_o.status::text, '_', ' ') using errcode = 'check_violation';
  end if;
  select t.payer_msisdn into v_msisdn from public.payment_transactions t where t.intent_id = v_e.intent_id and t.status = 'succeeded' limit 1;

  insert into public.refunds (order_id, escrow_id, buyer_id, amount_minor, currency, destination_msisdn, reason, requested_by)
  values (p_order, v_e.id, v_o.buyer_id, v_e.amount_minor, v_e.currency, v_msisdn, left(p_reason, 500), p_actor) returning id into v_refund;
  update public.escrow_accounts set status = 'refunded', refunded_at = now(), refunded_minor = v_e.amount_minor where id = v_e.id;
  perform public.ledger_post(p_order, v_e.currency, 'escrow_refunded',
    jsonb_build_array(jsonb_build_object('account', 'escrow', 'direction', 'debit', 'amount', v_e.amount_minor),
                      jsonb_build_object('account', 'refunds_payable', 'direction', 'credit', 'amount', v_e.amount_minor)),
    null, null, v_refund, left(p_reason, 300));
  update public.carrier_assignments set status = 'cancelled', cancelled_at = now() where order_id = p_order and status = 'active';
  update public.orders set status = 'refunded', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, 'refunded', p_actor, p_role, left(p_reason, 500));
  perform public.write_audit_log('escrow.refunded', 'order', p_order::text,
    jsonb_build_object('order_number', v_o.order_number, 'amount_minor', v_e.amount_minor, 'reason', left(p_reason, 300)));
  return v_refund;
end $$;

-- Refund part of the escrow. p_funded_by says whose share pays for it: the
-- seller (goods problem — the fee shrinks with the goods value) or the carrier
-- (freight problem). The rest is released as normal.
create or replace function public.refund_escrow_partial(
  p_order uuid, p_refund_minor bigint, p_funded_by text, p_actor uuid, p_role text, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_o public.orders%rowtype; v_e public.escrow_accounts%rowtype; v_msisdn text; v_refund uuid; v_carrier uuid;
  v_fee bigint; v_seller bigint; v_carr bigint;
begin
  if p_funded_by not in ('seller', 'carrier') then raise exception 'Choose whose share pays for the refund' using errcode = 'check_violation'; end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  select * into v_e from public.escrow_accounts where order_id = p_order for update;
  if not found then raise exception 'No funds are held for this order' using errcode = 'check_violation'; end if;
  if v_e.status <> 'held' then raise exception 'These funds are no longer held' using errcode = 'check_violation'; end if;
  if v_o.status not in ('paid_escrow', 'in_transit', 'delivered', 'awaiting_confirmation', 'disputed') then
    raise exception 'The order can''t be refunded from "%"', replace(v_o.status::text, '_', ' ') using errcode = 'check_violation';
  end if;
  if p_refund_minor is null or p_refund_minor < 1 or p_refund_minor >= v_e.amount_minor then
    raise exception 'A partial refund must be more than zero and less than the full amount' using errcode = 'check_violation';
  end if;

  v_fee := v_e.fee_minor; v_seller := v_e.seller_net_minor; v_carr := v_e.carrier_net_minor;
  if p_funded_by = 'seller' then
    if p_refund_minor > v_o.subtotal_minor then raise exception 'That is more than the goods are worth' using errcode = 'check_violation'; end if;
    v_fee := public.fee_for(v_o.subtotal_minor - p_refund_minor, v_o.platform_fee_bps);
    v_seller := v_o.subtotal_minor - p_refund_minor - v_fee;
  else
    if p_refund_minor > v_e.carrier_net_minor then raise exception 'That is more than the freight charge' using errcode = 'check_violation'; end if;
    v_carr := v_e.carrier_net_minor - p_refund_minor;
  end if;

  select t.payer_msisdn into v_msisdn from public.payment_transactions t where t.intent_id = v_e.intent_id and t.status = 'succeeded' limit 1;
  insert into public.refunds (order_id, escrow_id, buyer_id, amount_minor, currency, destination_msisdn, reason, requested_by)
  values (p_order, v_e.id, v_o.buyer_id, p_refund_minor, v_e.currency, v_msisdn, left(p_reason, 500), p_actor) returning id into v_refund;

  update public.escrow_accounts set status = 'released', released_at = now(), refunded_minor = p_refund_minor where id = v_e.id;
  perform public.ledger_post(p_order, v_e.currency, 'escrow_partial_refund',
    jsonb_build_array(
      jsonb_build_object('account', 'escrow', 'direction', 'debit', 'amount', v_e.amount_minor),
      jsonb_build_object('account', 'refunds_payable', 'direction', 'credit', 'amount', p_refund_minor),
      jsonb_build_object('account', 'platform_fees', 'direction', 'credit', 'amount', v_fee),
      jsonb_build_object('account', 'seller_payable', 'direction', 'credit', 'amount', v_seller),
      jsonb_build_object('account', 'carrier_payable', 'direction', 'credit', 'amount', v_carr)),
    null, null, v_refund, left(p_reason, 300));

  if v_seller > 0 then
    insert into public.payouts (order_id, recipient, seller_business_id, amount_minor, currency)
    values (p_order, 'seller', v_o.seller_business_id, v_seller, v_e.currency);
  end if;
  v_carrier := public.order_carrier_id(p_order);
  if v_carr > 0 and v_carrier is not null then
    insert into public.payouts (order_id, recipient, carrier_id, amount_minor, currency)
    values (p_order, 'carrier', v_carrier, v_carr, v_e.currency);
  end if;

  update public.carrier_assignments set status = 'completed' where order_id = p_order and status = 'active';
  update public.order_deliveries set completed_at = now(), confirmation_method = 'admin' where order_id = p_order and completed_at is null;
  update public.orders set status = 'partially_refunded', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, 'partially_refunded', p_actor, p_role, left(p_reason, 500));
  perform public.write_audit_log('escrow.partially_refunded', 'order', p_order::text,
    jsonb_build_object('order_number', v_o.order_number, 'refund_minor', p_refund_minor, 'funded_by', p_funded_by, 'reason', left(p_reason, 300)));
  return v_refund;
end $$;

-- Phase 5's admin wrappers now share the internals and refuse to bypass a live dispute.
create or replace function public.admin_release_escrow(p_order uuid, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if v_note is null or char_length(v_note) < 3 then raise exception 'Say why you are releasing these funds' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.disputes where order_id = p_order and status in ('open', 'under_review')) then
    raise exception 'This order has an open dispute — resolve the dispute instead' using errcode = 'check_violation';
  end if;
  return public.settle_escrow(p_order, v_uid, 'admin', 'admin', v_note);
end $$;

create or replace function public.admin_refund_escrow(p_order uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if v_reason is null or char_length(v_reason) < 3 then raise exception 'Say why you are refunding this order' using errcode = 'check_violation'; end if;
  if exists (select 1 from public.disputes where order_id = p_order and status in ('open', 'under_review')) then
    raise exception 'This order has an open dispute — resolve the dispute instead' using errcode = 'check_violation';
  end if;
  return public.refund_escrow_full(p_order, v_uid, 'admin', v_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Carrier delivery workflow
-- ---------------------------------------------------------------------------
create or replace function public.carrier_active_order(p_order uuid)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  if not exists (select 1 from public.carrier_assignments where order_id = p_order and carrier_id = v_uid and status = 'active')
     or not public.has_role('carrier') then
    raise exception 'This is not your delivery' using errcode = 'insufficient_privilege';
  end if;
  return v_o;
end $$;

create or replace function public.carrier_mark_picked_up(p_order uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  v_o := public.carrier_active_order(p_order);
  if v_note is not null and char_length(v_note) > 300 then raise exception 'Keep the note under 300 characters' using errcode = 'check_violation'; end if;
  if v_o.status <> 'paid_escrow' then
    raise exception 'Pickup starts once the buyer''s payment is held in escrow (now: %)', replace(v_o.status::text, '_', ' ') using errcode = 'check_violation';
  end if;
  insert into public.order_deliveries (order_id, carrier_id) values (p_order, v_uid);
  insert into public.delivery_codes (order_id, code) values (p_order, public.new_delivery_code());
  update public.orders set status = 'in_transit', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, 'paid_escrow', 'in_transit', v_uid, 'carrier', coalesce(v_note, 'Goods picked up'));
  insert into public.delivery_events (order_id, kind, actor_id, actor_role, note) values (p_order, 'picked_up', v_uid, 'carrier', v_note);
end $$;

create or replace function public.carrier_post_checkpoint(p_order uuid, p_note text default null, p_lat numeric default null, p_lng numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_gap integer := public.setting_int('delivery.checkpoint_min_seconds', 120);
begin
  v_o := public.carrier_active_order(p_order);
  if v_o.status <> 'in_transit' then raise exception 'Updates can be shared while the goods are in transit' using errcode = 'check_violation'; end if;
  if v_note is not null and char_length(v_note) > 300 then raise exception 'Keep the note under 300 characters' using errcode = 'check_violation'; end if;
  if v_note is null and p_lat is null then raise exception 'Add a note or share your location' using errcode = 'check_violation'; end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'That location isn''t valid' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.delivery_events where order_id = p_order and kind = 'checkpoint' and actor_id = v_uid
                and created_at > now() - make_interval(secs => v_gap)) then
    raise exception 'You just shared an update — wait a couple of minutes before the next one' using errcode = 'check_violation';
  end if;
  insert into public.delivery_events (order_id, kind, actor_id, actor_role, note, lat, lng)
  values (p_order, 'checkpoint', v_uid, 'carrier', v_note, round(p_lat, 4), round(p_lng, 4));
end $$;

create or replace function public.carrier_mark_arrived(p_order uuid, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  v_o := public.carrier_active_order(p_order);
  if v_o.status <> 'in_transit' then raise exception 'The goods must be in transit to report arrival' using errcode = 'check_violation'; end if;
  if v_note is not null and char_length(v_note) > 300 then raise exception 'Keep the note under 300 characters' using errcode = 'check_violation'; end if;
  update public.order_deliveries set arrived_at = now() where order_id = p_order;
  update public.orders set status = 'awaiting_confirmation', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, 'in_transit', 'awaiting_confirmation', v_uid, 'carrier', coalesce(v_note, 'Arrived at the delivery address'));
  insert into public.delivery_events (order_id, kind, actor_id, actor_role, note) values (p_order, 'arrived', v_uid, 'carrier', v_note);
end $$;

create or replace function public.carrier_report_delivery_failed(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_o := public.carrier_active_order(p_order);
  if v_o.status not in ('in_transit', 'awaiting_confirmation') then raise exception 'There is no delivery in progress to report on' using errcode = 'check_violation'; end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'Say what went wrong (5 to 300 characters)' using errcode = 'check_violation';
  end if;
  insert into public.delivery_events (order_id, kind, actor_id, actor_role, note) values (p_order, 'delivery_failed', v_uid, 'carrier', v_reason);
end $$;

-- The buyer reads the code out at handover; the carrier types it in. A wrong
-- code is counted (no exception, so the count is kept) and locks after a few tries.
create or replace function public.carrier_confirm_delivery(p_order uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_c public.delivery_codes%rowtype;
  v_max integer := public.setting_int('delivery.code_max_attempts', 5);
begin
  v_o := public.carrier_active_order(p_order);
  if p_code is null or p_code !~ '^[0-9]{6}$' then raise exception 'The delivery code is 6 digits' using errcode = 'check_violation'; end if;
  if v_o.status = 'disputed' then raise exception 'This order has an open dispute — the code can''t be used now' using errcode = 'check_violation'; end if;
  if v_o.status not in ('in_transit', 'awaiting_confirmation') then raise exception 'There is no delivery to confirm right now' using errcode = 'check_violation'; end if;
  select * into v_c from public.delivery_codes where order_id = p_order for update;
  if not found then raise exception 'No delivery code exists for this order' using errcode = 'check_violation'; end if;
  if v_c.locked then return 'locked'; end if;
  if v_c.code <> p_code then
    update public.delivery_codes set attempts = attempts + 1, locked = (attempts + 1 >= v_max) where order_id = p_order;
    return case when v_c.attempts + 1 >= v_max then 'locked' else 'wrong_code' end;
  end if;
  perform public.settle_escrow(p_order, v_uid, 'carrier', 'buyer_code', 'Delivery code confirmed at handover');
  return 'confirmed';
end $$;

create or replace function public.buyer_confirm_delivery(p_order uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found or v_o.buyer_id <> v_uid or not public.has_role('buyer') then raise exception 'Only the buyer can confirm delivery' using errcode = 'insufficient_privilege'; end if;
  if v_o.status = 'completed' then return false; end if;
  if v_o.status = 'disputed' then raise exception 'This order has an open dispute' using errcode = 'check_violation'; end if;
  if v_o.status not in ('in_transit', 'awaiting_confirmation') then raise exception 'There is nothing to confirm yet' using errcode = 'check_violation'; end if;
  return public.settle_escrow(p_order, v_uid, 'buyer', 'buyer', 'Buyer confirmed the goods were received');
end $$;

create or replace function public.regenerate_delivery_code(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found or v_o.buyer_id is distinct from v_uid then raise exception 'Only the buyer can do this' using errcode = 'insufficient_privilege'; end if;
  if v_o.status not in ('in_transit', 'awaiting_confirmation') then raise exception 'There is no delivery in progress' using errcode = 'check_violation'; end if;
  update public.delivery_codes set code = public.new_delivery_code(), attempts = 0, locked = false, regenerated_at = now() where order_id = p_order;
  if not found then raise exception 'No delivery code exists for this order' using errcode = 'check_violation'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Unpaid orders: buyer/admin cancel, and the automatic expiry sweep
-- ---------------------------------------------------------------------------
create or replace function public.cancel_unpaid_internal(p_order uuid, p_actor uuid, p_role text, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_o public.orders%rowtype; v_item record;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  if v_o.status = 'cancelled' then return false; end if;
  if v_o.status not in ('carrier_selected', 'awaiting_payment') then
    raise exception 'Only an unpaid order can be cancelled here' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.payment_intents where order_id = p_order and status = 'succeeded') then
    raise exception 'This order has already been paid' using errcode = 'check_violation';
  end if;
  update public.payment_intents set status = 'expired' where order_id = p_order and status in ('requires_payment', 'processing');
  update public.payment_transactions set status = 'expired' where order_id = p_order and status in ('initiated', 'pending');
  for v_item in select product_id, quantity from public.order_items where order_id = p_order and product_id is not null loop
    update public.products set quantity_available = quantity_available + v_item.quantity where id = v_item.product_id;
  end loop;
  update public.carrier_assignments set status = 'cancelled', cancelled_at = now() where order_id = p_order and status = 'active';
  update public.freight_rfqs set status = 'cancelled' where order_id = p_order and status = 'awarded';
  update public.orders
     set status = 'cancelled', version = version + 1, cancelled_at = now(), cancelled_by = p_role, cancellation_reason = left(p_reason, 500)
   where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, 'cancelled', p_actor, p_role, left(p_reason, 500));
  if p_role = 'admin' then
    perform public.write_audit_log('order.admin_transition', 'order', p_order::text,
      jsonb_build_object('order_number', v_o.order_number, 'from', v_o.status, 'to', 'cancelled', 'note', left(p_reason, 300)));
  end if;
  return true;
end $$;

create or replace function public.cancel_unpaid_order(p_order uuid, p_reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Cancelled before payment');
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_o from public.orders where id = p_order;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  if char_length(v_reason) > 500 then raise exception 'Keep the reason under 500 characters' using errcode = 'check_violation'; end if;
  if v_o.buyer_id = v_uid and public.has_role('buyer') then
    if exists (select 1 from public.payment_intents where order_id = p_order and status = 'processing' and expires_at > now()) then
      raise exception 'A payment is waiting for your approval. Wait for it to finish or expire before cancelling.' using errcode = 'check_violation';
    end if;
    return public.cancel_unpaid_internal(p_order, v_uid, 'buyer', v_reason);
  elsif public.is_admin() then
    return public.cancel_unpaid_internal(p_order, v_uid, 'admin', v_reason);
  end if;
  raise exception 'You cannot cancel this order' using errcode = 'insufficient_privilege';
end $$;

-- Run by the scheduled job (service role only). Idempotent; bounded per run.
create or replace function public.sweep_overdue_orders()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_window integer := public.setting_int('orders.payment_window_hours', 48);
  v_confirm integer := public.setting_int('delivery.auto_confirm_hours', 72);
  v_id uuid; v_expired integer := 0; v_released integer := 0;
begin
  for v_id in
    select o.id from public.orders o
     where o.status in ('carrier_selected', 'awaiting_payment')
       and exists (select 1 from public.carrier_assignments ca where ca.order_id = o.id and ca.status = 'active'
                     and ca.assigned_at < now() - make_interval(hours => v_window))
       and not exists (select 1 from public.payment_intents i where i.order_id = o.id and i.status = 'processing' and i.expires_at > now())
     order by o.updated_at limit 100
  loop
    begin
      if public.cancel_unpaid_internal(v_id, null, 'system', 'Not paid in time') then v_expired := v_expired + 1; end if;
    exception when others then
      perform public.write_audit_log('sweep.order_failed', 'order', v_id::text, jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  for v_id in
    select d.order_id from public.order_deliveries d
      join public.orders o on o.id = d.order_id
     where o.status = 'awaiting_confirmation' and d.completed_at is null
       and d.arrived_at < now() - make_interval(hours => v_confirm)
     order by d.arrived_at limit 100
  loop
    begin
      if public.settle_escrow(v_id, null, 'system', 'auto', 'Released automatically — no response from the buyer after arrival') then v_released := v_released + 1; end if;
    exception when others then
      perform public.write_audit_log('sweep.order_failed', 'order', v_id::text, jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  if v_expired + v_released > 0 then
    perform public.write_audit_log('sweep.ran', 'system', 'sweep', jsonb_build_object('expired_unpaid', v_expired, 'auto_released', v_released));
  end if;
  return jsonb_build_object('expired_unpaid', v_expired, 'auto_released', v_released);
end $$;

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------
create sequence public.dispute_number_seq start 1001;

create table public.disputes (
  id                     uuid primary key default gen_random_uuid(),
  dispute_number         text not null unique default ('D-' || nextval('public.dispute_number_seq')),
  order_id               uuid not null references public.orders (id) on delete restrict,
  opened_by              uuid not null references public.profiles (id) on delete restrict,
  opened_by_role         text not null check (opened_by_role in ('buyer', 'seller', 'carrier')),
  kind                   public.dispute_kind not null,
  description            text not null check (char_length(btrim(description)) between 10 and 2000),
  status                 public.dispute_status not null default 'open',
  prior_order_status     public.order_status not null,
  requested_refund_minor bigint check (requested_refund_minor is null or requested_refund_minor > 0),
  resolution             text check (resolution is null or resolution in ('refund', 'partial_refund', 'release', 'reject', 'withdrawn')),
  fault                  text check (fault is null or fault in ('seller', 'carrier', 'none')),
  refund_minor           bigint check (refund_minor is null or refund_minor > 0),
  decision_note          text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by             uuid references public.profiles (id) on delete set null,
  decided_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index disputes_one_live_per_order on public.disputes (order_id) where status in ('open', 'under_review');
create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_opened_by_idx on public.disputes (opened_by);
create index disputes_decided_by_idx on public.disputes (decided_by) where decided_by is not null;
create trigger disputes_set_updated_at before update on public.disputes for each row execute function public.set_updated_at();

create table public.dispute_messages (
  id          bigint generated always as identity primary key,
  dispute_id  uuid not null references public.disputes (id) on delete restrict,
  author_id   uuid references public.profiles (id) on delete set null,
  author_role text not null check (author_role in ('buyer', 'seller', 'carrier', 'admin', 'system')),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index dispute_messages_dispute_idx on public.dispute_messages (dispute_id, id);
create index dispute_messages_author_idx on public.dispute_messages (author_id) where author_id is not null;
create trigger dispute_messages_append_only before update or delete on public.dispute_messages
  for each row execute function public.prevent_mutation();

create table public.dispute_evidence (
  id           uuid primary key default gen_random_uuid(),
  dispute_id   uuid not null references public.disputes (id) on delete restrict,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  uploader_role text not null check (uploader_role in ('buyer', 'seller', 'carrier', 'admin')),
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 160),
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime')),
  size_bytes   integer not null check (size_bytes between 1 and 26214400),
  caption      text check (caption is null or char_length(caption) <= 300),
  created_at   timestamptz not null default now()
);
create index dispute_evidence_dispute_idx on public.dispute_evidence (dispute_id, created_at);
create index dispute_evidence_uploader_idx on public.dispute_evidence (uploaded_by) where uploaded_by is not null;
create trigger dispute_evidence_append_only before update or delete on public.dispute_evidence
  for each row execute function public.prevent_mutation();

create or replace function public.is_dispute_party(p_dispute uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.disputes d where d.id = p_dispute and public.order_party_role(d.order_id) is not null)
$$;

create or replace function public.can_view_dispute(p_dispute uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_dispute_party(p_dispute) or public.is_admin()
$$;

-- Storage: evidence lives in a PRIVATE bucket, in a folder named for the dispute.
-- Parties can add files to a live dispute and read every file on it. Nobody deletes.
create or replace function public.dispute_object_dispute(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(coalesce(p_name, ''), '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end
$$;

create or replace function public.can_add_dispute_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.disputes d
     where d.id = public.dispute_object_dispute(p_name) and d.status in ('open', 'under_review')
       and (public.order_party_role(d.order_id) is not null or public.is_admin())
  )
$$;

create or replace function public.can_read_dispute_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_view_dispute(public.dispute_object_dispute(p_name)), false)
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy dispute_evidence_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (select public.can_add_dispute_object(name)));
create policy dispute_evidence_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'dispute-evidence' and (select public.can_read_dispute_object(name)));

-- open a dispute: freezes the order and the escrow until an admin decides
create or replace function public.open_dispute(
  p_order uuid, p_kind public.dispute_kind, p_description text, p_requested_refund_minor bigint default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_role text; v_id uuid;
  v_desc text := btrim(coalesce(p_description, ''));
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  v_role := public.order_party_role(p_order);
  if v_role is null then raise exception 'You are not part of this order' using errcode = 'insufficient_privilege'; end if;
  if v_o.status not in ('paid_escrow', 'in_transit', 'awaiting_confirmation') then
    raise exception 'A dispute can be opened while the payment is held in escrow' using errcode = 'check_violation';
  end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 2000 then raise exception 'Describe the problem in 10 to 2000 characters' using errcode = 'check_violation'; end if;
  if p_requested_refund_minor is not null and (v_role <> 'buyer' or p_requested_refund_minor < 1 or p_requested_refund_minor > v_o.total_minor) then
    raise exception 'That refund request isn''t valid' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.disputes where order_id = p_order and status in ('open', 'under_review')) then
    raise exception 'There is already an open dispute for this order' using errcode = 'check_violation';
  end if;
  insert into public.disputes (order_id, opened_by, opened_by_role, kind, description, prior_order_status, requested_refund_minor)
  values (p_order, v_uid, v_role, p_kind, v_desc, v_o.status, p_requested_refund_minor) returning id into v_id;
  update public.orders set status = 'disputed', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, 'disputed', v_uid, v_role, 'Dispute opened: ' || replace(p_kind::text, '_', ' '));
  insert into public.dispute_messages (dispute_id, author_id, author_role, body) values (v_id, v_uid, v_role, v_desc);
  perform public.write_audit_log('dispute.opened', 'dispute', v_id::text, jsonb_build_object('order_number', v_o.order_number, 'kind', p_kind, 'by', v_role));
  return v_id;
end $$;

create or replace function public.add_dispute_message(p_dispute uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_d public.disputes%rowtype; v_role text; v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_d from public.disputes where id = p_dispute;
  if not found then raise exception 'Dispute not found' using errcode = 'no_data_found'; end if;
  v_role := public.order_party_role(v_d.order_id);
  if v_role is null then
    if public.is_admin() then v_role := 'admin'; else raise exception 'You are not part of this dispute' using errcode = 'insufficient_privilege'; end if;
  end if;
  if v_d.status not in ('open', 'under_review') then raise exception 'This dispute is closed' using errcode = 'check_violation'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'Write a message of up to 2000 characters' using errcode = 'check_violation'; end if;
  insert into public.dispute_messages (dispute_id, author_id, author_role, body) values (p_dispute, v_uid, v_role, v_body);
end $$;

-- Registers a file the browser already placed in the private bucket.
create or replace function public.register_dispute_evidence(
  p_dispute uuid, p_path text, p_file_name text, p_mime text, p_size integer, p_caption text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_d public.disputes%rowtype; v_role text; v_id uuid;
  v_max integer := public.setting_int('disputes.max_evidence_files', 12);
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Dispute not found' using errcode = 'no_data_found'; end if;
  v_role := public.order_party_role(v_d.order_id);
  if v_role is null then
    if public.is_admin() then v_role := 'admin'; else raise exception 'You are not part of this dispute' using errcode = 'insufficient_privilege'; end if;
  end if;
  if v_d.status not in ('open', 'under_review') then raise exception 'This dispute is closed' using errcode = 'check_violation'; end if;
  if p_path !~ ('^' || p_dispute::text || '/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov)$') then raise exception 'That file isn''t valid' using errcode = 'check_violation'; end if;
  if (select count(*) from public.dispute_evidence where dispute_id = p_dispute) >= v_max then
    raise exception 'This dispute already has the maximum number of files (%)', v_max using errcode = 'check_violation';
  end if;
  insert into public.dispute_evidence (dispute_id, uploaded_by, uploader_role, storage_path, file_name, mime_type, size_bytes, caption)
  values (p_dispute, v_uid, v_role, p_path, left(p_file_name, 160), p_mime, p_size, nullif(left(btrim(coalesce(p_caption, '')), 300), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.withdraw_dispute(p_dispute uuid, p_note text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_d public.disputes%rowtype; v_o public.orders%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Dispute not found' using errcode = 'no_data_found'; end if;
  if v_d.opened_by <> v_uid then raise exception 'Only the person who opened the dispute can withdraw it' using errcode = 'insufficient_privilege'; end if;
  if v_d.status = 'resolved' and v_d.resolution = 'withdrawn' then return false; end if;
  if v_d.status not in ('open', 'under_review') then raise exception 'This dispute is already closed' using errcode = 'check_violation'; end if;
  select * into v_o from public.orders where id = v_d.order_id for update;
  update public.disputes set status = 'resolved', resolution = 'withdrawn', decision_note = left(v_note, 1000), decided_at = now() where id = p_dispute;
  update public.orders set status = v_d.prior_order_status, version = version + 1 where id = v_d.order_id and status = 'disputed';
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (v_d.order_id, 'disputed', v_d.prior_order_status, v_uid, v_d.opened_by_role, 'Dispute withdrawn');
  insert into public.dispute_messages (dispute_id, author_id, author_role, body)
  values (p_dispute, v_uid, v_d.opened_by_role, 'Withdrew the dispute' || coalesce(': ' || v_note, '.'));
  return true;
end $$;

create or replace function public.admin_start_dispute_review(p_dispute uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_d public.disputes%rowtype;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Dispute not found' using errcode = 'no_data_found'; end if;
  if v_d.status = 'under_review' then return false; end if;
  if v_d.status <> 'open' then raise exception 'This dispute is already closed' using errcode = 'check_violation'; end if;
  update public.disputes set status = 'under_review' where id = p_dispute;
  insert into public.dispute_messages (dispute_id, author_id, author_role, body) values (p_dispute, v_uid, 'admin', 'GbanaB2B has started reviewing this dispute.');
  perform public.write_audit_log('dispute.review_started', 'dispute', p_dispute::text, jsonb_build_object('dispute', v_d.dispute_number));
  return true;
end $$;

-- The only way a dispute touches money. Outcomes:
--   refund          whole escrow back to the buyer
--   partial_refund  p_refund_minor back to the buyer, funded by p_fault's share; the rest is released
--   release         funds released as normal (dispute settled)
--   reject          claim rejected; funds released as normal
create or replace function public.admin_resolve_dispute(
  p_dispute uuid, p_outcome text, p_note text, p_fault text default 'none', p_refund_minor bigint default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_d public.disputes%rowtype; v_o public.orders%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_status public.dispute_status; v_refund bigint; v_carrier uuid;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if v_note is null or char_length(v_note) < 10 or char_length(v_note) > 1000 then
    raise exception 'Explain the decision to both sides (10 to 1000 characters)' using errcode = 'check_violation';
  end if;
  if p_outcome not in ('refund', 'partial_refund', 'release', 'reject') then raise exception 'Unknown outcome' using errcode = 'check_violation'; end if;
  if p_fault not in ('seller', 'carrier', 'none') then raise exception 'Unknown fault' using errcode = 'check_violation'; end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'Dispute not found' using errcode = 'no_data_found'; end if;
  if v_d.status not in ('open', 'under_review') then
    if v_d.resolution = p_outcome then return v_d.status::text; end if;
    raise exception 'This dispute is already closed' using errcode = 'check_violation';
  end if;
  select * into v_o from public.orders where id = v_d.order_id for update;
  v_carrier := public.order_carrier_id(v_d.order_id);

  if p_outcome = 'refund' then
    v_refund := (select amount_minor from public.escrow_accounts where order_id = v_d.order_id);
    perform public.refund_escrow_full(v_d.order_id, v_uid, 'admin', v_note);
    v_status := 'refunded';
  elsif p_outcome = 'partial_refund' then
    if p_fault not in ('seller', 'carrier') then raise exception 'A partial refund is paid by the seller''s or the carrier''s share — choose one' using errcode = 'check_violation'; end if;
    v_refund := p_refund_minor;
    perform public.refund_escrow_partial(v_d.order_id, p_refund_minor, p_fault, v_uid, 'admin', v_note);
    v_status := 'partial_refund';
  else
    perform public.settle_escrow(v_d.order_id, v_uid, 'admin', 'admin', v_note);
    v_status := case p_outcome when 'reject' then 'rejected' else 'resolved' end;
  end if;

  update public.disputes
     set status = v_status, resolution = p_outcome, fault = p_fault, refund_minor = v_refund,
         decision_note = v_note, decided_by = v_uid, decided_at = now()
   where id = p_dispute;
  if p_outcome in ('refund', 'partial_refund') then
    if p_fault = 'seller' then perform public.bump_trust('seller', v_o.seller_business_id, 0, 0, 1);
    elsif p_fault = 'carrier' then perform public.bump_trust('carrier', v_carrier, 0, 0, 1); end if;
  end if;
  insert into public.dispute_messages (dispute_id, author_id, author_role, body)
  values (p_dispute, v_uid, 'admin', 'Decision: ' || replace(v_status::text, '_', ' ') || '. ' || v_note);
  perform public.write_audit_log('dispute.resolved', 'dispute', p_dispute::text,
    jsonb_build_object('dispute', v_d.dispute_number, 'order_number', v_o.order_number, 'outcome', p_outcome, 'fault', p_fault, 'refund_minor', v_refund));
  return v_status::text;
end $$;

-- ---------------------------------------------------------------------------
-- Reviews — real buyers, real completed orders, one per subject per order.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete restrict,
  reviewer_id        uuid not null references public.profiles (id) on delete restrict,
  subject_kind       text not null check (subject_kind in ('seller', 'carrier')),
  seller_business_id uuid references public.businesses (id) on delete restrict,
  carrier_id         uuid references public.carrier_profiles (id) on delete restrict,
  rating             smallint not null check (rating between 1 and 5),
  comment            text check (comment is null or char_length(comment) <= 1000),
  reviewer_label     text not null check (char_length(reviewer_label) between 1 and 80),
  reply              text check (reply is null or char_length(reply) <= 500),
  replied_at         timestamptz,
  is_hidden          boolean not null default false,
  hidden_reason      text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  created_at         timestamptz not null default now(),
  unique (order_id, subject_kind),
  check ((subject_kind = 'seller' and seller_business_id is not null and carrier_id is null)
      or (subject_kind = 'carrier' and carrier_id is not null and seller_business_id is null))
);
create index reviews_seller_idx on public.reviews (seller_business_id, created_at desc) where seller_business_id is not null;
create index reviews_carrier_idx on public.reviews (carrier_id, created_at desc) where carrier_id is not null;
create index reviews_reviewer_idx on public.reviews (reviewer_id);
comment on table public.reviews is 'Ratings are immutable once posted (only the subject may add one reply; only admins may hide). Public columns exclude reviewer_id and order_id.';

create or replace function public.reviews_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Reviews can''t be deleted' using errcode = 'insufficient_privilege'; end if;
  if new.order_id is distinct from old.order_id or new.reviewer_id is distinct from old.reviewer_id or new.subject_kind is distinct from old.subject_kind
     or new.seller_business_id is distinct from old.seller_business_id or new.carrier_id is distinct from old.carrier_id
     or new.rating is distinct from old.rating or new.comment is distinct from old.comment or new.reviewer_label is distinct from old.reviewer_label
     or new.created_at is distinct from old.created_at then
    raise exception 'A posted review can''t be edited' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger reviews_guard before update or delete on public.reviews for each row execute function public.reviews_guard();

create or replace function public.submit_review(p_order uuid, p_subject text, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_id uuid; v_carrier uuid; v_done timestamptz;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_days integer := public.setting_int('reviews.window_days', 30);
  v_label text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into v_o from public.orders where id = p_order;
  if not found or v_o.buyer_id <> v_uid or not public.has_role('buyer') then raise exception 'Only the buyer of a completed order can review it' using errcode = 'insufficient_privilege'; end if;
  if v_o.status not in ('completed', 'partially_refunded') then raise exception 'You can review once the order is complete' using errcode = 'check_violation'; end if;
  if p_subject not in ('seller', 'carrier') then raise exception 'Choose the seller or the carrier' using errcode = 'check_violation'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose a rating from 1 to 5' using errcode = 'check_violation'; end if;
  if v_comment is not null and char_length(v_comment) > 1000 then raise exception 'Keep the comment under 1000 characters' using errcode = 'check_violation'; end if;
  select coalesce(d.completed_at, h.created_at) into v_done
    from (select max(created_at) as created_at from public.order_status_history where order_id = p_order and to_status in ('completed', 'partially_refunded')) h
    left join public.order_deliveries d on d.order_id = p_order;
  if v_done is not null and now() > v_done + make_interval(days => v_days) then raise exception 'The review window for this order has closed' using errcode = 'check_violation'; end if;
  v_label := left(coalesce(nullif(btrim(v_o.buyer_snapshot ->> 'business_name'), ''), nullif(btrim(v_o.buyer_snapshot ->> 'name'), ''), 'Verified buyer'), 80);
  if p_subject = 'carrier' then
    v_carrier := public.order_carrier_id(p_order);
    if v_carrier is null then raise exception 'This order had no carrier to review' using errcode = 'check_violation'; end if;
  end if;
  insert into public.reviews (order_id, reviewer_id, subject_kind, seller_business_id, carrier_id, rating, comment, reviewer_label)
  values (p_order, v_uid, p_subject, case when p_subject = 'seller' then v_o.seller_business_id end, v_carrier, p_rating, v_comment, v_label)
  returning id into v_id;
  perform public.bump_trust(p_subject, case when p_subject = 'seller' then v_o.seller_business_id else v_carrier end, 0, 0, 0, 1, p_rating);
  return v_id;
end $$;

create or replace function public.reply_to_review(p_review uuid, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_r public.reviews%rowtype; v_reply text := btrim(coalesce(p_reply, ''));
begin
  select * into v_r from public.reviews where id = p_review for update;
  if not found then raise exception 'Review not found' using errcode = 'no_data_found'; end if;
  if not ((v_r.subject_kind = 'seller' and public.can_edit_business(v_r.seller_business_id))
       or (v_r.subject_kind = 'carrier' and v_r.carrier_id = v_uid)) then
    raise exception 'Only the reviewed party can reply' using errcode = 'insufficient_privilege';
  end if;
  if v_r.reply is not null then raise exception 'You have already replied to this review' using errcode = 'check_violation'; end if;
  if char_length(v_reply) < 2 or char_length(v_reply) > 500 then raise exception 'Keep the reply between 2 and 500 characters' using errcode = 'check_violation'; end if;
  update public.reviews set reply = v_reply, replied_at = now() where id = p_review;
end $$;

create or replace function public.admin_hide_review(p_review uuid, p_hidden boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_r public.reviews%rowtype; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_subject uuid;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if p_hidden and (v_reason is null or char_length(v_reason) < 5) then raise exception 'Say why this review is being hidden' using errcode = 'check_violation'; end if;
  select * into v_r from public.reviews where id = p_review for update;
  if not found then raise exception 'Review not found' using errcode = 'no_data_found'; end if;
  if v_r.is_hidden = p_hidden then return false; end if;
  v_subject := case v_r.subject_kind when 'seller' then v_r.seller_business_id else v_r.carrier_id end;
  update public.reviews set is_hidden = p_hidden, hidden_reason = case when p_hidden then left(v_reason, 300) end where id = p_review;
  perform public.bump_trust(v_r.subject_kind, v_subject, 0, 0, 0, case when p_hidden then -1 else 1 end, case when p_hidden then -v_r.rating else v_r.rating end);
  perform public.write_audit_log(case when p_hidden then 'review.hidden' else 'review.restored' end, 'review', p_review::text,
    jsonb_build_object('subject', v_r.subject_kind, 'reason', v_reason));
  return true;
end $$;

-- What the signed-in party needs to know about reviews on an order.
create or replace function public.order_review_status(p_order uuid)
returns table (subject_kind text, rating smallint, comment text, reply text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.subject_kind, r.rating, r.comment, r.reply, r.created_at
    from public.reviews r
   where r.order_id = p_order and (public.can_view_order(p_order) or public.is_order_carrier(p_order))
$$;

create or replace function public.admin_list_reviews(p_limit integer default 100)
returns table (id uuid, order_number text, subject_kind text, subject_name text, rating smallint, comment text, reply text,
               reviewer_label text, is_hidden boolean, hidden_reason text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, o.order_number, r.subject_kind,
         case r.subject_kind when 'seller' then b.trading_name else c.full_name end,
         r.rating, r.comment, r.reply, r.reviewer_label, r.is_hidden, r.hidden_reason, r.created_at
    from public.reviews r
    join public.orders o on o.id = r.order_id
    left join public.businesses b on b.id = r.seller_business_id
    left join public.carrier_profiles c on c.id = r.carrier_id
   where public.is_admin()
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Internal helpers: never callable from a browser.
revoke execute on function
  public.bump_trust(text, uuid, integer, integer, integer, integer, integer),
  public.orders_trust_trigger(), public.reviews_guard(), public.new_delivery_code(),
  public.settle_escrow(uuid, uuid, text, text, text),
  public.refund_escrow_full(uuid, uuid, text, text),
  public.refund_escrow_partial(uuid, bigint, text, uuid, text, text),
  public.cancel_unpaid_internal(uuid, uuid, text, text),
  public.carrier_active_order(uuid),
  public.order_carrier_id(uuid), public.order_party_role(uuid),
  public.dispute_object_dispute(text)
  from public, anon, authenticated;

-- Policy helpers: authenticated only (they answer "may I?" for the caller).
revoke execute on function public.is_order_carrier(uuid), public.is_dispute_party(uuid), public.can_view_dispute(uuid),
  public.can_add_dispute_object(text), public.can_read_dispute_object(text) from public, anon;
grant execute on function public.is_order_carrier(uuid), public.is_dispute_party(uuid), public.can_view_dispute(uuid),
  public.can_add_dispute_object(text), public.can_read_dispute_object(text) to authenticated, service_role;

-- Workflows: signed-in users (each re-checks who they are inside).
revoke execute on function
  public.carrier_mark_picked_up(uuid, text), public.carrier_post_checkpoint(uuid, text, numeric, numeric),
  public.carrier_mark_arrived(uuid, text), public.carrier_report_delivery_failed(uuid, text),
  public.carrier_confirm_delivery(uuid, text), public.buyer_confirm_delivery(uuid), public.regenerate_delivery_code(uuid),
  public.cancel_unpaid_order(uuid, text),
  public.open_dispute(uuid, public.dispute_kind, text, bigint), public.add_dispute_message(uuid, text),
  public.register_dispute_evidence(uuid, text, text, text, integer, text), public.withdraw_dispute(uuid, text),
  public.admin_start_dispute_review(uuid), public.admin_resolve_dispute(uuid, text, text, text, bigint),
  public.submit_review(uuid, text, integer, text), public.reply_to_review(uuid, text), public.admin_hide_review(uuid, boolean, text),
  public.order_review_status(uuid), public.admin_list_reviews(integer),
  public.admin_release_escrow(uuid, text), public.admin_refund_escrow(uuid, text)
  from public, anon;
grant execute on function
  public.carrier_mark_picked_up(uuid, text), public.carrier_post_checkpoint(uuid, text, numeric, numeric),
  public.carrier_mark_arrived(uuid, text), public.carrier_report_delivery_failed(uuid, text),
  public.carrier_confirm_delivery(uuid, text), public.buyer_confirm_delivery(uuid), public.regenerate_delivery_code(uuid),
  public.cancel_unpaid_order(uuid, text),
  public.open_dispute(uuid, public.dispute_kind, text, bigint), public.add_dispute_message(uuid, text),
  public.register_dispute_evidence(uuid, text, text, text, integer, text), public.withdraw_dispute(uuid, text),
  public.admin_start_dispute_review(uuid), public.admin_resolve_dispute(uuid, text, text, text, bigint),
  public.submit_review(uuid, text, integer, text), public.reply_to_review(uuid, text), public.admin_hide_review(uuid, boolean, text),
  public.order_review_status(uuid), public.admin_list_reviews(integer),
  public.admin_release_escrow(uuid, text), public.admin_refund_escrow(uuid, text)
  to authenticated;

-- Scheduled job only.
revoke execute on function public.sweep_overdue_orders() from public, anon, authenticated;
grant execute on function public.sweep_overdue_orders() to service_role;

-- Tables: read-only for clients, through RLS. Nothing is written directly.
alter table public.trust_stats       enable row level security;
alter table public.order_deliveries  enable row level security;
alter table public.delivery_events   enable row level security;
alter table public.delivery_codes    enable row level security;
alter table public.disputes          enable row level security;
alter table public.dispute_messages  enable row level security;
alter table public.dispute_evidence  enable row level security;
alter table public.reviews           enable row level security;

revoke all on table public.trust_stats, public.order_deliveries, public.delivery_events, public.delivery_codes,
  public.disputes, public.dispute_messages, public.dispute_evidence, public.reviews from anon, authenticated;
grant select on table public.trust_stats to anon, authenticated;
grant select on table public.order_deliveries, public.delivery_events, public.delivery_codes,
  public.disputes, public.dispute_messages, public.dispute_evidence to authenticated;
-- Public review columns only (no reviewer_id, no order_id, no moderation notes).
grant select (id, subject_kind, seller_business_id, carrier_id, rating, comment, reviewer_label, reply, replied_at, created_at)
  on table public.reviews to anon, authenticated;
grant all on table public.trust_stats, public.order_deliveries, public.delivery_events, public.delivery_codes,
  public.disputes, public.dispute_messages, public.dispute_evidence, public.reviews to service_role;
grant usage on sequence public.dispute_number_seq to service_role;

create policy trust_stats_select on public.trust_stats for select to anon, authenticated using (true);

create policy order_deliveries_select on public.order_deliveries for select to authenticated
  using ((select public.can_view_order(order_id)) or carrier_id = (select auth.uid()));
create policy delivery_events_select on public.delivery_events for select to authenticated
  using ((select public.can_view_order(order_id)) or (select public.is_order_carrier(order_id)));

-- Only the BUYER of the order can see the code.
create policy delivery_codes_select on public.delivery_codes for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())));

create policy disputes_select on public.disputes for select to authenticated using ((select public.can_view_dispute(id)));
create policy dispute_messages_select on public.dispute_messages for select to authenticated using ((select public.can_view_dispute(dispute_id)));
create policy dispute_evidence_select on public.dispute_evidence for select to authenticated using ((select public.can_view_dispute(dispute_id)));

create policy reviews_select_public on public.reviews for select to anon, authenticated using (not is_hidden);

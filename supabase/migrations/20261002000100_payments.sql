-- ============================================================================
-- GbanaB2B · Phase 5 · Financial engine
-- exchange_rates, payment_intents, payment_transactions, provider_events,
-- escrow_accounts, ledger_entries (append-only, double-entry), payouts, refunds.
-- Every money movement goes through a SECURITY DEFINER workflow below; clients
-- can read what they're allowed to see and write nothing directly.
-- Provider calls happen in the app server; success only ever arrives through
-- apply_provider_event() (service role), never from a browser.
-- See docs/database/payments.md and docs/payments/README.md.
-- ============================================================================

create type public.payment_provider_id as enum ('sandbox', 'mtn_momo_lr', 'orange_money_lr');
create type public.payment_status as enum ('initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'expired');
create type public.payment_intent_status as enum ('requires_payment', 'processing', 'succeeded', 'cancelled', 'expired');
create type public.escrow_status as enum ('held', 'released', 'refunded');
create type public.payout_status as enum ('pending', 'initiated', 'paid', 'failed');
create type public.payout_recipient as enum ('seller', 'carrier');
create type public.refund_status as enum ('pending', 'paid', 'failed');

insert into public.platform_settings (key, value, description, is_sensitive, min_value, max_value) values
  ('payments.sandbox_enabled', '1', 'Allow the clearly-labelled TEST payment provider (no real money). Set to 0 before real launch.', true, 0, 1),
  ('payments.mtn_enabled', '0', 'Allow MTN Mobile Money payments. Turn on only after the verified adapter and credentials are live.', true, 0, 1),
  ('payments.orange_enabled', '0', 'Allow Orange Money payments. Turn on only after the verified adapter and credentials are live.', true, 0, 1),
  ('payments.intent_expiry_minutes', '30', 'Minutes a buyer has to approve a mobile-money prompt before the attempt expires.', false, 5, 1440)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- exchange_rates — append-only history. Payments snapshot the rate they saw.
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  id           bigint generated always as identity primary key,
  base         public.currency_code not null,
  quote        public.currency_code not null,
  rate         numeric(18, 6) not null check (rate > 0),
  note         text check (note is null or char_length(note) <= 300),
  set_by       uuid references public.profiles (id) on delete set null,
  effective_at timestamptz not null default now(),
  check (base <> quote)
);
create index exchange_rates_pair_idx on public.exchange_rates (base, quote, effective_at desc);
create index exchange_rates_set_by_idx on public.exchange_rates (set_by);
create trigger exchange_rates_append_only
  before update or delete on public.exchange_rates
  for each row execute function public.prevent_mutation();

-- ---------------------------------------------------------------------------
-- payment_intents — the buyer's intention to pay one order in full.
-- payment_transactions — each attempt with a provider.
-- ---------------------------------------------------------------------------
create table public.payment_intents (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete restrict,
  buyer_id      uuid not null references public.profiles (id) on delete restrict,
  currency      public.currency_code not null,
  amount_minor  bigint not null check (amount_minor > 0),
  status        public.payment_intent_status not null default 'requires_payment',
  fx_usd_lrd    numeric(18, 6),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index payment_intents_one_live on public.payment_intents (order_id) where status in ('requires_payment', 'processing');
create unique index payment_intents_one_paid on public.payment_intents (order_id) where status = 'succeeded';
create index payment_intents_buyer_idx on public.payment_intents (buyer_id, created_at desc);
create trigger payment_intents_set_updated_at before update on public.payment_intents for each row execute function public.set_updated_at();

create table public.payment_transactions (
  id                   uuid primary key default gen_random_uuid(),
  intent_id            uuid not null references public.payment_intents (id) on delete restrict,
  order_id             uuid not null references public.orders (id) on delete restrict,
  provider             public.payment_provider_id not null,
  provider_txn_id      text,
  idempotency_key      text not null unique check (char_length(idempotency_key) between 8 and 100),
  status               public.payment_status not null default 'initiated',
  amount_minor         bigint not null check (amount_minor > 0),
  currency             public.currency_code not null,
  payer_msisdn         text not null check (payer_msisdn ~ '^\+[1-9][0-9]{7,14}$'),
  failure_reason       text check (failure_reason is null or char_length(failure_reason) <= 300),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index payment_transactions_provider_ref on public.payment_transactions (provider, provider_txn_id) where provider_txn_id is not null;
create index payment_transactions_intent_idx on public.payment_transactions (intent_id);
create index payment_transactions_order_idx on public.payment_transactions (order_id, created_at desc);
create index payment_transactions_status_idx on public.payment_transactions (status, created_at);
create trigger payment_transactions_set_updated_at before update on public.payment_transactions for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- provider_events — every verified provider message, once. Replays are no-ops.
-- ---------------------------------------------------------------------------
create table public.provider_events (
  id               bigint generated always as identity primary key,
  provider         public.payment_provider_id not null,
  event_id         text not null check (char_length(event_id) between 1 and 200),
  reference        uuid not null,
  provider_txn_id  text,
  status           public.payment_status not null,
  amount_minor     bigint,
  currency         public.currency_code,
  payload          jsonb not null default '{}'::jsonb,
  outcome          text,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  unique (provider, event_id)
);
create index provider_events_reference_idx on public.provider_events (reference);

create or replace function public.provider_events_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Provider events are permanent' using errcode = 'insufficient_privilege'; end if;
  if new.provider is distinct from old.provider or new.event_id is distinct from old.event_id or new.reference is distinct from old.reference
     or new.status is distinct from old.status or new.payload is distinct from old.payload or new.amount_minor is distinct from old.amount_minor then
    raise exception 'Provider events can only record their outcome' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger provider_events_guard before update or delete on public.provider_events for each row execute function public.provider_events_guard();

-- ---------------------------------------------------------------------------
-- escrow_accounts — one per order. Shares are fixed when funded.
-- ---------------------------------------------------------------------------
create table public.escrow_accounts (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null unique references public.orders (id) on delete restrict,
  intent_id         uuid not null unique references public.payment_intents (id) on delete restrict,
  currency          public.currency_code not null,
  amount_minor      bigint not null check (amount_minor > 0),
  fee_minor         bigint not null check (fee_minor >= 0),
  seller_net_minor  bigint not null check (seller_net_minor >= 0),
  carrier_net_minor bigint not null check (carrier_net_minor >= 0),
  status            public.escrow_status not null default 'held',
  funded_at         timestamptz not null default now(),
  released_at       timestamptz,
  refunded_at       timestamptz,
  check (amount_minor = fee_minor + seller_net_minor + carrier_net_minor)
);

-- ---------------------------------------------------------------------------
-- ledger_entries — append-only, double-entry. Each entry_group must balance.
-- ---------------------------------------------------------------------------
create table public.ledger_entries (
  id          bigint generated always as identity primary key,
  entry_group uuid not null,
  order_id    uuid references public.orders (id) on delete restrict,
  account     text not null check (account in ('provider_clearing', 'escrow', 'platform_fees', 'seller_payable', 'carrier_payable',
                                                'payouts_clearing', 'refunds_payable', 'unapplied_funds')),
  direction   text not null check (direction in ('debit', 'credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency    public.currency_code not null,
  kind        text not null check (char_length(kind) between 3 and 60),
  payment_txn_id uuid references public.payment_transactions (id) on delete restrict,
  payout_id   uuid,
  refund_id   uuid,
  memo        text check (memo is null or char_length(memo) <= 300),
  created_at  timestamptz not null default now()
);
create index ledger_entries_order_idx on public.ledger_entries (order_id, id);
create index ledger_entries_group_idx on public.ledger_entries (entry_group);
create index ledger_entries_txn_idx on public.ledger_entries (payment_txn_id);
create trigger ledger_entries_append_only before update or delete on public.ledger_entries for each row execute function public.prevent_mutation();
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries for each statement execute function public.prevent_mutation();

create or replace function public.ledger_group_balanced()
returns trigger language plpgsql set search_path = '' as $$
declare v_bad integer;
begin
  select count(*) into v_bad from (
    select currency from public.ledger_entries where entry_group = new.entry_group
    group by currency
    having sum(case direction when 'debit' then amount_minor else -amount_minor end) <> 0
  ) x;
  if v_bad > 0 then raise exception 'Unbalanced ledger entry group %', new.entry_group using errcode = 'check_violation'; end if;
  return null;
end $$;
create constraint trigger ledger_entries_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.ledger_group_balanced();

create view public.ledger_balances with (security_invoker = true) as
  select currency, account,
         sum(case direction when 'credit' then amount_minor else -amount_minor end)::bigint as balance_minor,
         count(*)::bigint as entries
    from public.ledger_entries group by currency, account;

-- ---------------------------------------------------------------------------
-- payouts and refunds
-- ---------------------------------------------------------------------------
create table public.payouts (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete restrict,
  recipient          public.payout_recipient not null,
  seller_business_id uuid references public.businesses (id) on delete restrict,
  carrier_id         uuid references public.carrier_profiles (id) on delete restrict,
  amount_minor       bigint not null check (amount_minor > 0),
  currency           public.currency_code not null,
  status             public.payout_status not null default 'pending',
  provider           public.payment_provider_id,
  destination_msisdn text check (destination_msisdn is null or destination_msisdn ~ '^\+[1-9][0-9]{7,14}$'),
  provider_ref       text,
  failure_reason     text check (failure_reason is null or char_length(failure_reason) <= 300),
  attempts           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (order_id, recipient),
  check ((recipient = 'seller' and seller_business_id is not null and carrier_id is null)
      or (recipient = 'carrier' and carrier_id is not null and seller_business_id is null))
);
create index payouts_seller_idx on public.payouts (seller_business_id) where seller_business_id is not null;
create index payouts_carrier_idx on public.payouts (carrier_id) where carrier_id is not null;
create index payouts_status_idx on public.payouts (status, created_at);
create trigger payouts_set_updated_at before update on public.payouts for each row execute function public.set_updated_at();

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null unique references public.orders (id) on delete restrict,
  escrow_id          uuid not null unique references public.escrow_accounts (id) on delete restrict,
  buyer_id           uuid not null references public.profiles (id) on delete restrict,
  amount_minor       bigint not null check (amount_minor > 0),
  currency           public.currency_code not null,
  status             public.refund_status not null default 'pending',
  destination_msisdn text not null check (destination_msisdn ~ '^\+[1-9][0-9]{7,14}$'),
  reason             text not null check (char_length(btrim(reason)) between 3 and 500),
  requested_by       uuid references public.profiles (id) on delete set null,
  provider_ref       text,
  failure_reason     text check (failure_reason is null or char_length(failure_reason) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index refunds_buyer_idx on public.refunds (buyer_id);
create index refunds_requested_by_idx on public.refunds (requested_by);
create trigger refunds_set_updated_at before update on public.refunds for each row execute function public.set_updated_at();

alter table public.ledger_entries
  add constraint ledger_entries_payout_fk foreign key (payout_id) references public.payouts (id) on delete restrict,
  add constraint ledger_entries_refund_fk foreign key (refund_id) references public.refunds (id) on delete restrict;
create index ledger_entries_payout_idx on public.ledger_entries (payout_id) where payout_id is not null;
create index ledger_entries_refund_idx on public.ledger_entries (refund_id) where refund_id is not null;

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------
create or replace function public.setting_int(p_key text, p_default integer)
returns integer language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::integer from public.platform_settings where key = p_key), p_default)
$$;

create or replace function public.provider_enabled(p_provider public.payment_provider_id)
returns boolean language sql stable set search_path = '' as $$
  select public.setting_int(case p_provider
           when 'sandbox' then 'payments.sandbox_enabled'
           when 'mtn_momo_lr' then 'payments.mtn_enabled'
           else 'payments.orange_enabled' end, 0) = 1
$$;

-- lines: [{"account": "...", "direction": "debit|credit", "amount": 123}, ...]
create or replace function public.ledger_post(
  p_order uuid, p_currency public.currency_code, p_kind text, p_lines jsonb,
  p_txn uuid default null, p_payout uuid default null, p_refund uuid default null, p_memo text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_group uuid := gen_random_uuid(); v_line jsonb;
begin
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if (v_line ->> 'amount')::bigint > 0 then
      insert into public.ledger_entries (entry_group, order_id, account, direction, amount_minor, currency, kind, payment_txn_id, payout_id, refund_id, memo)
      values (v_group, p_order, v_line ->> 'account', v_line ->> 'direction', (v_line ->> 'amount')::bigint, p_currency, p_kind, p_txn, p_payout, p_refund, p_memo);
    end if;
  end loop;
  return v_group;
end $$;

create or replace function public.fund_escrow(p_order uuid, p_intent uuid, p_txn uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_o public.orders%rowtype; v_seller bigint; v_carrier bigint; v_total bigint;
begin
  select * into v_o from public.orders where id = p_order;
  v_carrier := coalesce(v_o.freight_minor, 0);
  v_seller := v_o.subtotal_minor - v_o.platform_fee_minor;
  v_total := v_o.subtotal_minor + v_carrier;
  insert into public.escrow_accounts (order_id, intent_id, currency, amount_minor, fee_minor, seller_net_minor, carrier_net_minor)
  values (p_order, p_intent, v_o.currency, v_total, v_o.platform_fee_minor, v_seller, v_carrier);
  perform public.ledger_post(p_order, v_o.currency, 'escrow_funded',
    jsonb_build_array(jsonb_build_object('account', 'provider_clearing', 'direction', 'debit', 'amount', v_total),
                      jsonb_build_object('account', 'escrow', 'direction', 'credit', 'amount', v_total)),
    p_txn, null, null, 'Buyer payment confirmed by provider');
  update public.payment_intents set status = 'succeeded' where id = p_intent;
  update public.orders set status = 'paid_escrow', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, 'awaiting_payment', 'paid_escrow', null, 'system', 'Payment confirmed — funds held in escrow');
  perform public.write_audit_log('payment.escrow_funded', 'order', p_order::text,
    jsonb_build_object('amount_minor', v_total, 'currency', v_o.currency, 'fee_minor', v_o.platform_fee_minor, 'txn', p_txn));
end $$;

-- ---------------------------------------------------------------------------
-- Exchange rates (admin)
-- ---------------------------------------------------------------------------
create or replace function public.set_exchange_rate(p_base public.currency_code, p_quote public.currency_code, p_rate numeric, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_prev numeric;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if p_base = p_quote then raise exception 'Choose two different currencies' using errcode = 'check_violation'; end if;
  if p_rate is null or p_rate <= 0 or p_rate > 1000000 then raise exception 'Enter a rate above zero' using errcode = 'check_violation'; end if;
  select rate into v_prev from public.exchange_rates where base = p_base and quote = p_quote order by effective_at desc, id desc limit 1;
  insert into public.exchange_rates (base, quote, rate, note, set_by) values (p_base, p_quote, p_rate, nullif(btrim(coalesce(p_note, '')), ''), v_uid);
  perform public.write_audit_log('exchange_rate.changed', 'exchange_rate', p_base::text || '/' || p_quote::text,
    jsonb_build_object('from', v_prev, 'to', p_rate, 'note', p_note));
end $$;

-- ---------------------------------------------------------------------------
-- Buyer: open a payment attempt for an order with a booked carrier
-- ---------------------------------------------------------------------------
create or replace function public.start_payment(
  p_order uuid, p_provider public.payment_provider_id, p_msisdn text, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_o public.orders%rowtype;
  v_i public.payment_intents%rowtype;
  v_has boolean := false;
  v_txn uuid;
  v_fx numeric;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = 'insufficient_privilege'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'Missing payment reference' using errcode = 'check_violation';
  end if;

  select t.id into v_txn from public.payment_transactions t where t.idempotency_key = p_idempotency_key;
  if found then
    if not exists (select 1 from public.payment_intents i join public.payment_transactions t on t.intent_id = i.id
                    where t.id = v_txn and i.buyer_id = v_uid) then
      raise exception 'You cannot use this payment reference' using errcode = 'insufficient_privilege';
    end if;
    return v_txn;
  end if;

  if p_msisdn is null or p_msisdn !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Enter the mobile-money number in international format, like +231770000000' using errcode = 'check_violation';
  end if;

  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  if v_o.buyer_id <> v_uid or not public.has_role('buyer') then
    raise exception 'Only the buyer can pay for this order' using errcode = 'insufficient_privilege';
  end if;
  if v_o.status not in ('carrier_selected', 'awaiting_payment') then
    raise exception 'Payment opens once a carrier is booked' using errcode = 'check_violation';
  end if;
  if v_o.freight_minor is null then raise exception 'Book a carrier before paying' using errcode = 'check_violation'; end if;
  if not public.provider_enabled(p_provider) then
    raise exception 'This payment method isn''t available yet' using errcode = 'check_violation';
  end if;

  select * into v_i from public.payment_intents where order_id = p_order and status in ('requires_payment', 'processing') for update;
  v_has := found;
  if v_has and (v_i.expires_at < now() or v_i.amount_minor <> v_o.total_minor) then
    update public.payment_transactions set status = 'expired', failure_reason = 'Attempt expired' where intent_id = v_i.id and status in ('initiated', 'pending');
    update public.payment_intents set status = 'expired' where id = v_i.id;
    v_has := false;
  end if;
  if v_has and exists (select 1 from public.payment_transactions where intent_id = v_i.id and status in ('initiated', 'pending')) then
    raise exception 'A payment is already waiting for approval on your phone. Approve it, or wait for it to expire.' using errcode = 'check_violation';
  end if;

  if not v_has then
    select rate into v_fx from public.exchange_rates where base = 'USD' and quote = 'LRD' order by effective_at desc, id desc limit 1;
    insert into public.payment_intents (order_id, buyer_id, currency, amount_minor, fx_usd_lrd, expires_at)
    values (p_order, v_uid, v_o.currency, v_o.total_minor, v_fx,
            now() + make_interval(mins => public.setting_int('payments.intent_expiry_minutes', 30)))
    returning * into v_i;
  else
    update public.payment_intents
       set status = 'processing',
           expires_at = now() + make_interval(mins => public.setting_int('payments.intent_expiry_minutes', 30))
     where id = v_i.id returning * into v_i;
  end if;

  insert into public.payment_transactions (intent_id, order_id, provider, idempotency_key, amount_minor, currency, payer_msisdn)
  values (v_i.id, p_order, p_provider, p_idempotency_key, v_o.total_minor, v_o.currency, p_msisdn)
  returning id into v_txn;
  update public.payment_intents set status = 'processing' where id = v_i.id;

  if v_o.status = 'carrier_selected' then
    update public.orders set status = 'awaiting_payment', version = version + 1 where id = p_order;
    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (p_order, 'carrier_selected', 'awaiting_payment', v_uid, 'buyer', 'Payment started');
  end if;
  return v_txn;
end $$;

-- ---------------------------------------------------------------------------
-- Server: record what the provider said when we asked it to collect (service role)
-- ---------------------------------------------------------------------------
create or replace function public.record_payment_attempt(
  p_txn uuid, p_provider_txn_id text, p_status public.payment_status, p_failure text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_t public.payment_transactions%rowtype;
begin
  select * into v_t from public.payment_transactions where id = p_txn for update;
  if not found then raise exception 'Payment not found' using errcode = 'no_data_found'; end if;
  if v_t.status <> 'initiated' then return; end if; -- a webhook may already have arrived
  if p_status not in ('pending', 'failed') then raise exception 'Unexpected status for a new attempt' using errcode = 'check_violation'; end if;
  update public.payment_transactions
     set status = p_status, provider_txn_id = coalesce(p_provider_txn_id, provider_txn_id),
         failure_reason = case when p_status = 'failed' then left(coalesce(p_failure, 'The provider declined the request'), 300) end
   where id = p_txn;
  if p_status = 'failed' then
    update public.payment_intents set status = 'requires_payment' where id = v_t.intent_id and status = 'processing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Server: apply a VERIFIED provider event (service role). Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.apply_provider_event(
  p_provider public.payment_provider_id, p_event_id text, p_reference uuid, p_provider_txn_id text,
  p_status public.payment_status, p_amount_minor bigint, p_currency public.currency_code, p_payload jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_event bigint; v_t public.payment_transactions%rowtype; v_i public.payment_intents%rowtype; v_o public.orders%rowtype;
  v_outcome text;
begin
  if p_status = 'initiated' then raise exception 'Invalid provider status' using errcode = 'check_violation'; end if;
  insert into public.provider_events (provider, event_id, reference, provider_txn_id, status, amount_minor, currency, payload)
  values (p_provider, p_event_id, p_reference, p_provider_txn_id, p_status, p_amount_minor, p_currency, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing
  returning id into v_event;
  if v_event is null then return 'duplicate_event'; end if;

  select * into v_t from public.payment_transactions where id = p_reference for update;
  if not found or v_t.provider <> p_provider then
    v_outcome := 'unknown_reference';
  elsif (p_amount_minor is not null and p_amount_minor <> v_t.amount_minor) or (p_currency is not null and p_currency <> v_t.currency) then
    v_outcome := 'amount_mismatch';
  elsif p_status = 'succeeded' then
    if v_t.status = 'succeeded' then
      v_outcome := 'already_applied';
    else
      select * into v_o from public.orders where id = v_t.order_id for update;
      select * into v_i from public.payment_intents where id = v_t.intent_id for update;
      update public.payment_transactions
         set status = 'succeeded', provider_txn_id = coalesce(p_provider_txn_id, provider_txn_id), failure_reason = null
       where id = v_t.id;
      if v_o.status = 'awaiting_payment' and v_i.status in ('requires_payment', 'processing') then
        perform public.fund_escrow(v_o.id, v_i.id, v_t.id);
        v_outcome := case when v_t.status in ('initiated', 'pending') then 'applied' else 'applied_late' end;
      else
        perform public.ledger_post(v_t.order_id, v_t.currency, 'payment_unapplied',
          jsonb_build_array(jsonb_build_object('account', 'provider_clearing', 'direction', 'debit', 'amount', v_t.amount_minor),
                            jsonb_build_object('account', 'unapplied_funds', 'direction', 'credit', 'amount', v_t.amount_minor)),
          v_t.id, null, null, 'Payment succeeded but the order could not accept it');
        v_outcome := 'orphan_success';
      end if;
    end if;
  elsif v_t.status = 'succeeded' then
    v_outcome := 'conflict_already_succeeded';
  elsif v_t.status in ('failed', 'cancelled', 'expired') then
    v_outcome := 'ignored_stale';
  elsif p_status = 'pending' then
    update public.payment_transactions set status = 'pending', provider_txn_id = coalesce(p_provider_txn_id, provider_txn_id) where id = v_t.id;
    v_outcome := 'applied';
  else
    update public.payment_transactions
       set status = p_status, provider_txn_id = coalesce(p_provider_txn_id, provider_txn_id),
           failure_reason = coalesce(nullif(left(p_payload ->> 'reason', 300), ''), 'Payment ' || p_status::text)
     where id = v_t.id;
    update public.payment_intents set status = 'requires_payment' where id = v_t.intent_id and status = 'processing';
    v_outcome := 'applied';
  end if;

  update public.provider_events set outcome = v_outcome, processed_at = now() where id = v_event;
  if v_outcome in ('unknown_reference', 'amount_mismatch', 'conflict_already_succeeded', 'orphan_success') then
    perform public.write_audit_log('payment.event_needs_review', 'payment_event', p_provider::text || ':' || p_event_id,
      jsonb_build_object('outcome', v_outcome, 'reference', p_reference, 'status', p_status, 'amount_minor', p_amount_minor));
  end if;
  return v_outcome;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: release escrow (human decision; the Phase 6 delivery code will call
-- the same internal path). Idempotent — a second call does nothing.
-- ---------------------------------------------------------------------------
create or replace function public.admin_release_escrow(p_order uuid, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_e public.escrow_accounts%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_carrier uuid; v_payout uuid;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if v_note is null or char_length(v_note) < 3 then raise exception 'Say why you are releasing these funds' using errcode = 'check_violation'; end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'no_data_found'; end if;
  select * into v_e from public.escrow_accounts where order_id = p_order for update;
  if not found then raise exception 'No funds are held for this order' using errcode = 'check_violation'; end if;
  if v_e.status = 'released' then return false; end if;
  if v_e.status <> 'held' then raise exception 'These funds were already %', v_e.status using errcode = 'check_violation'; end if;
  if v_o.status not in ('paid_escrow', 'in_transit', 'delivered', 'awaiting_confirmation') then
    raise exception 'The order can''t release funds from "%"', replace(v_o.status::text, '_', ' ') using errcode = 'check_violation';
  end if;

  update public.escrow_accounts set status = 'released', released_at = now() where id = v_e.id;
  perform public.ledger_post(p_order, v_e.currency, 'escrow_released',
    jsonb_build_array(
      jsonb_build_object('account', 'escrow', 'direction', 'debit', 'amount', v_e.amount_minor),
      jsonb_build_object('account', 'platform_fees', 'direction', 'credit', 'amount', v_e.fee_minor),
      jsonb_build_object('account', 'seller_payable', 'direction', 'credit', 'amount', v_e.seller_net_minor),
      jsonb_build_object('account', 'carrier_payable', 'direction', 'credit', 'amount', v_e.carrier_net_minor)),
    null, null, null, v_note);

  if v_e.seller_net_minor > 0 then
    insert into public.payouts (order_id, recipient, seller_business_id, amount_minor, currency)
    values (p_order, 'seller', v_o.seller_business_id, v_e.seller_net_minor, v_e.currency);
  end if;
  select ca.carrier_id into v_carrier from public.carrier_assignments ca where ca.order_id = p_order and ca.status in ('active', 'completed') order by ca.assigned_at desc limit 1;
  if v_e.carrier_net_minor > 0 and v_carrier is not null then
    insert into public.payouts (order_id, recipient, carrier_id, amount_minor, currency)
    values (p_order, 'carrier', v_carrier, v_e.carrier_net_minor, v_e.currency) returning id into v_payout;
  end if;

  update public.orders set status = 'completed', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, 'completed', v_uid, 'admin', left(v_note, 500));
  perform public.write_audit_log('escrow.released', 'order', p_order::text,
    jsonb_build_object('order_number', v_o.order_number, 'amount_minor', v_e.amount_minor, 'fee_minor', v_e.fee_minor, 'note', v_note));
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: refund the whole escrow back to the buyer (partial refunds arrive
-- with disputes in Phase 6).
-- ---------------------------------------------------------------------------
create or replace function public.admin_refund_escrow(p_order uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_o public.orders%rowtype; v_e public.escrow_accounts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_msisdn text; v_refund uuid;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if v_reason is null or char_length(v_reason) < 3 then raise exception 'Say why you are refunding this order' using errcode = 'check_violation'; end if;
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
  values (p_order, v_e.id, v_o.buyer_id, v_e.amount_minor, v_e.currency, v_msisdn, left(v_reason, 500), v_uid) returning id into v_refund;
  update public.escrow_accounts set status = 'refunded', refunded_at = now() where id = v_e.id;
  perform public.ledger_post(p_order, v_e.currency, 'escrow_refunded',
    jsonb_build_array(jsonb_build_object('account', 'escrow', 'direction', 'debit', 'amount', v_e.amount_minor),
                      jsonb_build_object('account', 'refunds_payable', 'direction', 'credit', 'amount', v_e.amount_minor)),
    null, null, v_refund, v_reason);
  update public.orders set status = 'refunded', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, 'refunded', v_uid, 'admin', left(v_reason, 500));
  perform public.write_audit_log('escrow.refunded', 'order', p_order::text,
    jsonb_build_object('order_number', v_o.order_number, 'amount_minor', v_e.amount_minor, 'reason', v_reason));
  return v_refund;
end $$;

create or replace function public.admin_mark_refund(p_refund uuid, p_paid boolean, p_provider_ref text default null, p_failure text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_r public.refunds%rowtype;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  select * into v_r from public.refunds where id = p_refund for update;
  if not found then raise exception 'Refund not found' using errcode = 'no_data_found'; end if;
  if p_paid then
    if v_r.status = 'paid' then return false; end if;
    update public.refunds set status = 'paid', provider_ref = left(p_provider_ref, 200), failure_reason = null where id = p_refund;
    perform public.ledger_post(v_r.order_id, v_r.currency, 'refund_paid',
      jsonb_build_array(jsonb_build_object('account', 'refunds_payable', 'direction', 'debit', 'amount', v_r.amount_minor),
                        jsonb_build_object('account', 'provider_clearing', 'direction', 'credit', 'amount', v_r.amount_minor)),
      null, null, p_refund, 'Refund sent to buyer');
  else
    if v_r.status <> 'pending' then return false; end if;
    update public.refunds set status = 'failed', failure_reason = left(coalesce(p_failure, 'The provider could not send the refund'), 300) where id = p_refund;
  end if;
  perform public.write_audit_log('refund.recorded', 'refund', p_refund::text, jsonb_build_object('paid', p_paid, 'provider_ref', p_provider_ref));
  return true;
end $$;

-- A failed refund can be retried.
create or replace function public.admin_retry_refund(p_refund uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  update public.refunds set status = 'pending', failure_reason = null where id = p_refund and status = 'failed';
end $$;

-- ---------------------------------------------------------------------------
-- Admin: payouts to sellers and carriers
-- ---------------------------------------------------------------------------
create or replace function public.admin_begin_payout(p_payout uuid, p_provider public.payment_provider_id, p_msisdn text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_p public.payouts%rowtype;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  if p_msisdn is null or p_msisdn !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Enter the recipient''s mobile-money number in international format' using errcode = 'check_violation';
  end if;
  if not public.provider_enabled(p_provider) then raise exception 'This payment method isn''t available yet' using errcode = 'check_violation'; end if;
  select * into v_p from public.payouts where id = p_payout for update;
  if not found then raise exception 'Payout not found' using errcode = 'no_data_found'; end if;
  if v_p.status = 'initiated' or v_p.status = 'paid' then return false; end if;
  update public.payouts set status = 'initiated', provider = p_provider, destination_msisdn = p_msisdn, attempts = attempts + 1, failure_reason = null where id = p_payout;
  perform public.ledger_post(v_p.order_id, v_p.currency, 'payout_initiated',
    jsonb_build_array(jsonb_build_object('account', case v_p.recipient when 'seller' then 'seller_payable' else 'carrier_payable' end, 'direction', 'debit', 'amount', v_p.amount_minor),
                      jsonb_build_object('account', 'payouts_clearing', 'direction', 'credit', 'amount', v_p.amount_minor)),
    null, p_payout, null, 'Payout started');
  perform public.write_audit_log('payout.initiated', 'payout', p_payout::text,
    jsonb_build_object('recipient', v_p.recipient, 'amount_minor', v_p.amount_minor, 'provider', p_provider));
  return true;
end $$;

create or replace function public.admin_finish_payout(p_payout uuid, p_success boolean, p_provider_ref text default null, p_failure text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_p public.payouts%rowtype;
begin
  if v_uid is null or not public.is_admin() then raise exception 'Admins only' using errcode = 'insufficient_privilege'; end if;
  select * into v_p from public.payouts where id = p_payout for update;
  if not found then raise exception 'Payout not found' using errcode = 'no_data_found'; end if;
  if v_p.status <> 'initiated' then
    if (p_success and v_p.status = 'paid') or (not p_success and v_p.status = 'failed') then return false; end if;
    raise exception 'This payout is % and can''t be changed that way', v_p.status using errcode = 'check_violation';
  end if;
  if p_success then
    update public.payouts set status = 'paid', provider_ref = left(p_provider_ref, 200) where id = p_payout;
    perform public.ledger_post(v_p.order_id, v_p.currency, 'payout_paid',
      jsonb_build_array(jsonb_build_object('account', 'payouts_clearing', 'direction', 'debit', 'amount', v_p.amount_minor),
                        jsonb_build_object('account', 'provider_clearing', 'direction', 'credit', 'amount', v_p.amount_minor)),
      null, p_payout, null, 'Payout delivered');
  else
    update public.payouts set status = 'failed', failure_reason = left(coalesce(p_failure, 'The provider could not send the payout'), 300) where id = p_payout;
    perform public.ledger_post(v_p.order_id, v_p.currency, 'payout_failed',
      jsonb_build_array(jsonb_build_object('account', 'payouts_clearing', 'direction', 'debit', 'amount', v_p.amount_minor),
                        jsonb_build_object('account', case v_p.recipient when 'seller' then 'seller_payable' else 'carrier_payable' end, 'direction', 'credit', 'amount', v_p.amount_minor)),
      null, p_payout, null, 'Payout failed — returned to payable');
  end if;
  perform public.write_audit_log('payout.recorded', 'payout', p_payout::text, jsonb_build_object('success', p_success, 'provider_ref', p_provider_ref));
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.setting_int(text, integer), public.provider_enabled(public.payment_provider_id),
  public.ledger_post(uuid, public.currency_code, text, jsonb, uuid, uuid, uuid, text),
  public.fund_escrow(uuid, uuid, uuid), public.ledger_group_balanced(), public.provider_events_guard()
  from public, anon, authenticated;
grant execute on function public.provider_enabled(public.payment_provider_id) to authenticated, service_role;

revoke execute on function public.set_exchange_rate(public.currency_code, public.currency_code, numeric, text),
  public.start_payment(uuid, public.payment_provider_id, text, text),
  public.record_payment_attempt(uuid, text, public.payment_status, text),
  public.apply_provider_event(public.payment_provider_id, text, uuid, text, public.payment_status, bigint, public.currency_code, jsonb),
  public.admin_release_escrow(uuid, text), public.admin_refund_escrow(uuid, text),
  public.admin_mark_refund(uuid, boolean, text, text), public.admin_retry_refund(uuid),
  public.admin_begin_payout(uuid, public.payment_provider_id, text), public.admin_finish_payout(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.set_exchange_rate(public.currency_code, public.currency_code, numeric, text),
  public.start_payment(uuid, public.payment_provider_id, text, text),
  public.admin_release_escrow(uuid, text), public.admin_refund_escrow(uuid, text),
  public.admin_mark_refund(uuid, boolean, text, text), public.admin_retry_refund(uuid),
  public.admin_begin_payout(uuid, public.payment_provider_id, text), public.admin_finish_payout(uuid, boolean, text, text)
  to authenticated;
-- Webhook/provider-response paths: server only.
grant execute on function public.record_payment_attempt(uuid, text, public.payment_status, text),
  public.apply_provider_event(public.payment_provider_id, text, uuid, text, public.payment_status, bigint, public.currency_code, jsonb)
  to service_role;

alter table public.exchange_rates        enable row level security;
alter table public.payment_intents       enable row level security;
alter table public.payment_transactions  enable row level security;
alter table public.provider_events       enable row level security;
alter table public.escrow_accounts       enable row level security;
alter table public.ledger_entries        enable row level security;
alter table public.payouts               enable row level security;
alter table public.refunds               enable row level security;

revoke all on table public.exchange_rates, public.payment_intents, public.payment_transactions, public.provider_events,
  public.escrow_accounts, public.ledger_entries, public.payouts, public.refunds, public.ledger_balances from anon, authenticated;
revoke all on sequence public.exchange_rates_id_seq, public.provider_events_id_seq, public.ledger_entries_id_seq from anon, authenticated;
grant select on table public.exchange_rates, public.payment_intents, public.payment_transactions, public.provider_events,
  public.escrow_accounts, public.ledger_entries, public.payouts, public.refunds, public.ledger_balances to authenticated;
grant select on table public.payment_intents, public.payment_transactions, public.provider_events, public.escrow_accounts,
  public.payouts, public.refunds, public.ledger_entries, public.exchange_rates to service_role;

create policy exchange_rates_read on public.exchange_rates for select to authenticated using (true);
create policy payment_intents_select on public.payment_intents for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.is_admin()));
create policy payment_transactions_select on public.payment_transactions for select to authenticated
  using (exists (select 1 from public.payment_intents i where i.id = intent_id and i.buyer_id = (select auth.uid())) or (select public.is_admin()));
create policy provider_events_admin on public.provider_events for select to authenticated using ((select public.is_admin()));
create policy escrow_accounts_select on public.escrow_accounts for select to authenticated using ((select public.can_view_order(order_id)));
create policy ledger_entries_admin on public.ledger_entries for select to authenticated using ((select public.is_admin()));
create policy payouts_select on public.payouts for select to authenticated
  using ((seller_business_id is not null and (select public.is_business_member(seller_business_id)))
         or carrier_id = (select auth.uid()) or (select public.is_admin()));
create policy refunds_select on public.refunds for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.is_admin()));

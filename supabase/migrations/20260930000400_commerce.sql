-- ============================================================================
-- GbanaB2B · Migration 0009 · B2B commerce (Phase 3)
-- addresses, cart_items, orders, order_items, order_status_history,
-- proforma_invoices; place_orders() and transition_order() workflows.
-- See docs/database/commerce.md and docs/workflows/order-lifecycle.md.
-- ============================================================================

create type public.order_status as enum (
  'draft', 'pending_seller', 'confirmed', 'fulfilling', 'ready_for_freight',
  'freight_requested', 'carrier_selected', 'awaiting_payment', 'paid_escrow',
  'in_transit', 'delivered', 'awaiting_confirmation', 'completed',
  'cancelled', 'disputed', 'refunded', 'partially_refunded'
);

insert into public.platform_settings (key, value, description, is_sensitive, min_value, max_value) values
  ('commerce.max_cart_lines', '50', 'Maximum distinct products in one cart.', false, 1, 200),
  ('commerce.proforma_validity_days', '7', 'Days a proforma invoice price stays valid for payment.', false, 1, 60)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- addresses — a buyer's delivery destinations. Orders snapshot them.
-- ---------------------------------------------------------------------------
create table public.addresses (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  label          text not null check (char_length(btrim(label)) between 1 and 40),
  contact_name   text not null check (char_length(btrim(contact_name)) between 2 and 120),
  contact_phone  text not null check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  county         public.lr_county not null,
  town           text not null check (char_length(btrim(town)) between 2 and 80),
  street         text check (street is null or char_length(street) <= 200),
  landmark       text check (landmark is null or char_length(landmark) <= 200),
  latitude       numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude      numeric(9,6) check (longitude is null or longitude between -180 and 180),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index addresses_profile_idx on public.addresses (profile_id);
create unique index addresses_one_default on public.addresses (profile_id) where is_default;

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Keep exactly one default: the first address becomes default; choosing a new default clears the old one.
create or replace function public.addresses_default_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
     where profile_id = new.profile_id and id <> new.id and is_default;
  elsif tg_op = 'INSERT'
        and not exists (select 1 from public.addresses where profile_id = new.profile_id) then
    new.is_default := true;
  end if;
  return new;
end;
$$;

create trigger addresses_default_guard
  before insert or update of is_default on public.addresses
  for each row execute function public.addresses_default_guard();

-- Deleting the default promotes the most recently added remaining address.
create or replace function public.addresses_promote_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default then
    update public.addresses set is_default = true
     where id = (select id from public.addresses where profile_id = old.profile_id order by created_at desc limit 1);
  end if;
  return null;
end;
$$;

create trigger addresses_promote_default
  after delete on public.addresses
  for each row execute function public.addresses_promote_default();

create or replace function public.addresses_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.addresses where profile_id = new.profile_id) >= 20 then
    raise exception 'You can save up to 20 addresses' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger addresses_limit
  before insert on public.addresses
  for each row execute function public.addresses_limit();

-- ---------------------------------------------------------------------------
-- cart_items — a buyer's procurement list, persisted server-side so it
-- survives flaky connections and follows the user across devices.
-- ---------------------------------------------------------------------------
create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null check (quantity between 1 and 10000000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cart_items_unique unique (profile_id, product_id)
);

create index cart_items_product_idx on public.cart_items (product_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

create or replace function public.cart_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'commerce.max_cart_lines'), 50);
begin
  if not exists (
    select 1 from public.products p join public.businesses b on b.id = p.business_id
     where p.id = new.product_id and p.status = 'active' and b.status = 'active'
  ) then
    raise exception 'This product is not available' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.products p join public.business_members m on m.business_id = p.business_id
     where p.id = new.product_id and m.profile_id = new.profile_id
  ) then
    raise exception 'You cannot order from your own business' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.cart_items where profile_id = new.profile_id) >= v_max then
    raise exception 'Your cart can hold up to % products', v_max using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger cart_items_guard
  before insert or update on public.cart_items
  for each row execute function public.cart_items_guard();

-- ---------------------------------------------------------------------------
-- orders — one seller, one currency per order.
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start 1001;
create sequence public.proforma_number_seq start 1;

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique,
  buyer_id              uuid not null references public.profiles (id) on delete restrict,
  seller_business_id    uuid not null references public.businesses (id) on delete restrict,
  status                public.order_status not null default 'pending_seller',
  currency              public.currency_code not null,
  subtotal_minor        bigint not null check (subtotal_minor > 0),
  platform_fee_bps      integer not null check (platform_fee_bps between 0 and 10000),
  platform_fee_minor    bigint not null check (platform_fee_minor >= 0),
  freight_minor         bigint check (freight_minor is null or freight_minor >= 0),
  total_minor           bigint not null check (total_minor >= subtotal_minor),
  total_weight_g        bigint not null check (total_weight_g >= 0),
  item_count            integer not null check (item_count > 0),
  buyer_snapshot        jsonb not null check (jsonb_typeof(buyer_snapshot) = 'object'),
  seller_snapshot       jsonb not null check (jsonb_typeof(seller_snapshot) = 'object'),
  delivery_address      jsonb not null check (jsonb_typeof(delivery_address) = 'object'),
  buyer_note            text check (buyer_note is null or char_length(buyer_note) <= 500),
  cancellation_reason   text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  cancelled_by          text check (cancelled_by is null or cancelled_by in ('buyer', 'seller', 'admin', 'system')),
  placed_at             timestamptz not null default now(),
  confirmed_at          timestamptz,
  cancelled_at          timestamptz,
  version               integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.orders is 'Created only by place_orders(); status changes only through transition_order(). Money is integer minor units; fee and prices are snapshotted.';
comment on column public.orders.platform_fee_minor is 'Commission on the product subtotal, deducted from the seller''s proceeds (not added to the buyer total). Rounded half-up — see ADR 0010.';

create index orders_buyer_idx on public.orders (buyer_id, placed_at desc);
create index orders_seller_idx on public.orders (seller_business_id, status, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  title             text not null,
  unit_label        text not null,
  sku               text,
  packaging_type    public.packaging_type not null,
  quantity          integer not null check (quantity > 0),
  unit_price_minor  bigint not null check (unit_price_minor > 0),
  line_total_minor  bigint not null check (line_total_minor = unit_price_minor * quantity),
  unit_weight_g     integer not null check (unit_weight_g > 0),
  tier_min_qty      integer not null,
  tier_max_qty      integer
);

comment on table public.order_items is 'Immutable price/product snapshot at order time. Later product edits never change these rows.';

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create trigger order_items_immutable
  before update or delete on public.order_items
  for each row execute function public.prevent_mutation();

create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_role   text not null check (actor_role in ('buyer', 'seller', 'admin', 'system')),
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create trigger order_status_history_append_only
  before update or delete on public.order_status_history
  for each row execute function public.prevent_mutation();

create table public.proforma_invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  invoice_number  text not null unique,
  revision        integer not null default 1,
  snapshot        jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  issued_at       timestamptz not null default now(),
  constraint proforma_invoices_revision_unique unique (order_id, revision)
);

comment on table public.proforma_invoices is 'Immutable. A new revision is issued when the transaction changes (e.g. freight selected in Phase 4).';

create index proforma_invoices_order_idx on public.proforma_invoices (order_id, revision desc);

create trigger proforma_invoices_immutable
  before update or delete on public.proforma_invoices
  for each row execute function public.prevent_mutation();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_view_order(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order
       and (o.buyer_id = (select auth.uid())
            or public.is_business_member(o.seller_business_id)
            or public.is_admin())
  );
$$;

grant execute on function public.can_view_order(uuid) to authenticated, service_role;

-- Tier price for a quantity (null if below MOQ).
create or replace function public.tier_price(p_product uuid, p_qty integer)
returns table (unit_price_minor bigint, min_qty integer, max_qty integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.unit_price_minor, t.min_qty, t.max_qty
    from public.product_price_tiers t
   where t.product_id = p_product
     and p_qty >= t.min_qty
     and (t.max_qty is null or p_qty <= t.max_qty)
   limit 1;
$$;

revoke execute on function public.tier_price(uuid, integer) from public, anon, authenticated;

-- Half-up integer rounding of amount * bps / 10000 (ADR 0010).
create or replace function public.fee_for(p_amount bigint, p_bps integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select ((p_amount * p_bps + 5000) / 10000)::bigint;
$$;

grant execute on function public.fee_for(bigint, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- place_orders — checkout. Turns the caller's cart into one order per
-- (seller, currency), re-pricing every line from current tiers inside the
-- transaction. Returns the new order ids.
-- ---------------------------------------------------------------------------
create or replace function public.place_orders(
  p_address uuid,
  p_buyer_business_name text default null,
  p_note text default null
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_addr public.addresses%rowtype;
  v_fee_bps integer;
  v_group record;
  v_line record;
  v_order uuid;
  v_orders uuid[] := '{}';
  v_subtotal bigint;
  v_weight bigint;
  v_count integer;
  v_price record;
  v_address_json jsonb;
  v_buyer_json jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.has_role('buyer') then
    raise exception 'Add the buyer role to your account to place orders' using errcode = 'insufficient_privilege';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  select * into v_addr from public.addresses where id = p_address and profile_id = v_uid;
  if not found then
    raise exception 'Choose a delivery address' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.cart_items where profile_id = v_uid) then
    raise exception 'Your cart is empty' using errcode = 'check_violation';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = 'check_violation';
  end if;

  v_fee_bps := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'commerce.platform_fee_bps'), 0);

  v_address_json := jsonb_build_object(
    'label', v_addr.label, 'contact_name', v_addr.contact_name, 'contact_phone', v_addr.contact_phone,
    'county', v_addr.county, 'town', v_addr.town, 'street', v_addr.street, 'landmark', v_addr.landmark,
    'latitude', v_addr.latitude, 'longitude', v_addr.longitude);
  v_buyer_json := jsonb_build_object(
    'name', coalesce(v_profile.full_name, 'Buyer'), 'phone', v_profile.phone,
    'business_name', nullif(btrim(coalesce(p_buyer_business_name, '')), ''));

  -- Lock the products being bought so price/stock can't shift mid-checkout.
  perform 1 from public.products p
    where p.id in (select product_id from public.cart_items where profile_id = v_uid)
    for update;

  -- Validate every line first; nothing is created unless the whole cart is valid.
  for v_line in
    select c.quantity, p.id as product_id, p.title, p.status, p.moq, p.quantity_available, p.unit_weight_g,
           b.status as business_status, p.business_id
      from public.cart_items c
      join public.products p on p.id = c.product_id
      join public.businesses b on b.id = p.business_id
     where c.profile_id = v_uid
  loop
    if v_line.status <> 'active' or v_line.business_status <> 'active' then
      raise exception '"%" is no longer available — remove it from your cart', v_line.title using errcode = 'check_violation';
    end if;
    if v_line.quantity < v_line.moq then
      raise exception '"%" has a minimum order of %', v_line.title, v_line.moq using errcode = 'check_violation';
    end if;
    if v_line.quantity > v_line.quantity_available then
      raise exception 'Only % of "%" available', v_line.quantity_available, v_line.title using errcode = 'check_violation';
    end if;
    if public.is_business_member(v_line.business_id) then
      raise exception 'You cannot order from your own business' using errcode = 'check_violation';
    end if;
    select * into v_price from public.tier_price(v_line.product_id, v_line.quantity);
    if v_price.unit_price_minor is null then
      raise exception 'No price for % × "%"', v_line.quantity, v_line.title using errcode = 'check_violation';
    end if;
  end loop;

  for v_group in
    select p.business_id, p.currency
      from public.cart_items c join public.products p on p.id = c.product_id
     where c.profile_id = v_uid
     group by p.business_id, p.currency
  loop
    insert into public.orders (
      order_number, buyer_id, seller_business_id, currency, subtotal_minor, platform_fee_bps,
      platform_fee_minor, total_minor, total_weight_g, item_count, buyer_snapshot, seller_snapshot,
      delivery_address, buyer_note)
    select 'GB-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
           v_uid, b.id, v_group.currency, 1, v_fee_bps, 0, 1, 0, 1, v_buyer_json,
           jsonb_build_object('name', b.trading_name, 'slug', b.slug, 'county', b.county, 'town', b.town,
                              'address_line', b.address_line, 'phone', b.contact_phone,
                              'registration_number', b.registration_number, 'verification_status', b.verification_status),
           v_address_json, nullif(btrim(coalesce(p_note, '')), '')
      from public.businesses b where b.id = v_group.business_id
    returning id into v_order;

    v_subtotal := 0; v_weight := 0; v_count := 0;
    for v_line in
      select c.quantity, p.*
        from public.cart_items c join public.products p on p.id = c.product_id
       where c.profile_id = v_uid and p.business_id = v_group.business_id and p.currency = v_group.currency
       order by p.title
    loop
      select * into v_price from public.tier_price(v_line.id, v_line.quantity);
      insert into public.order_items (order_id, product_id, title, unit_label, sku, packaging_type, quantity,
                                      unit_price_minor, line_total_minor, unit_weight_g, tier_min_qty, tier_max_qty)
      values (v_order, v_line.id, v_line.title, v_line.unit_label, v_line.sku, v_line.packaging_type, v_line.quantity,
              v_price.unit_price_minor, v_price.unit_price_minor * v_line.quantity, v_line.unit_weight_g,
              v_price.min_qty, v_price.max_qty);
      v_subtotal := v_subtotal + v_price.unit_price_minor * v_line.quantity;
      v_weight := v_weight + v_line.unit_weight_g::bigint * v_line.quantity;
      v_count := v_count + 1;
    end loop;

    update public.orders
       set subtotal_minor = v_subtotal,
           platform_fee_minor = public.fee_for(v_subtotal, v_fee_bps),
           total_minor = v_subtotal,
           total_weight_g = v_weight,
           item_count = v_count
     where id = v_order;

    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (v_order, null, 'pending_seller', v_uid, 'buyer', 'Order placed');

    v_orders := v_orders || v_order;
  end loop;

  delete from public.cart_items where profile_id = v_uid;
  return v_orders;
end;
$$;

-- ---------------------------------------------------------------------------
-- issue_proforma — internal. Freezes the order into an invoice snapshot.
-- ---------------------------------------------------------------------------
create or replace function public.issue_proforma(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.orders%rowtype;
  v_rev integer;
  v_id uuid;
  v_validity integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'commerce.proforma_validity_days'), 7);
begin
  select * into v_o from public.orders where id = p_order;
  select coalesce(max(revision), 0) + 1 into v_rev from public.proforma_invoices where order_id = p_order;

  insert into public.proforma_invoices (order_id, invoice_number, revision, snapshot)
  values (
    p_order,
    'PI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.proforma_number_seq')::text, 6, '0'),
    v_rev,
    jsonb_build_object(
      'order_number', v_o.order_number,
      'status', v_o.status,
      'currency', v_o.currency,
      'buyer', v_o.buyer_snapshot,
      'seller', v_o.seller_snapshot,
      'delivery_address', v_o.delivery_address,
      'items', (select jsonb_agg(jsonb_build_object(
                  'title', i.title, 'unit_label', i.unit_label, 'sku', i.sku, 'quantity', i.quantity,
                  'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor,
                  'unit_weight_g', i.unit_weight_g) order by i.title)
                from public.order_items i where i.order_id = p_order),
      'subtotal_minor', v_o.subtotal_minor,
      'freight_minor', v_o.freight_minor,
      'platform_fee_bps', v_o.platform_fee_bps,
      'platform_fee_minor', v_o.platform_fee_minor,
      'total_minor', v_o.total_minor,
      'total_weight_g', v_o.total_weight_g,
      'carrier', null,
      'estimated_delivery', null,
      'payment_status', 'unpaid',
      'placed_at', v_o.placed_at,
      'valid_until', now() + make_interval(days => v_validity),
      'terms', jsonb_build_array(
        'Prices are fixed for the quantities shown and valid until the date above.',
        'Freight is quoted separately by verified carriers and added before payment.',
        'Payment is held in GbanaB2B escrow and released only after the buyer confirms delivery.',
        'The platform fee is deducted from the seller''s proceeds and is not added to the buyer''s total.',
        'This proforma invoice is not a tax invoice or a receipt.')
    )
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.issue_proforma(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- transition_order — the only way an order changes status. Checks who is
-- asking, that the move is allowed from the current state, handles stock
-- reservation and records history. Phase 3 covers everything up to
-- READY_FOR_FREIGHT; later phases add their own transitions here.
-- ---------------------------------------------------------------------------
create or replace function public.transition_order(
  p_order uuid,
  p_to public.order_status,
  p_note text default null,
  p_expected_version integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_o public.orders%rowtype;
  v_actor text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_window integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'commerce.order_cancellation_window_minutes'), 60);
  v_item record;
  v_reserved boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  if p_expected_version is not null and p_expected_version <> v_o.version then
    raise exception 'This order was updated by someone else. Refresh and try again.' using errcode = 'serialization_failure';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = 'check_violation';
  end if;

  -- Who is acting? Seller members take precedence only for their own orders.
  if public.can_edit_business(v_o.seller_business_id) then
    v_actor := 'seller';
  elsif v_o.buyer_id = v_uid and public.has_role('buyer') then
    v_actor := 'buyer';
  elsif public.is_admin() then
    v_actor := 'admin';
  else
    raise exception 'You cannot change this order' using errcode = 'insufficient_privilege';
  end if;

  if not (
    (v_o.status = 'pending_seller' and p_to = 'confirmed' and v_actor = 'seller') or
    (v_o.status = 'pending_seller' and p_to = 'cancelled' and v_actor in ('buyer', 'seller', 'admin')) or
    (v_o.status = 'confirmed' and p_to = 'fulfilling' and v_actor = 'seller') or
    (v_o.status = 'confirmed' and p_to = 'cancelled' and v_actor in ('buyer', 'seller', 'admin')) or
    (v_o.status = 'fulfilling' and p_to = 'ready_for_freight' and v_actor = 'seller') or
    (v_o.status = 'fulfilling' and p_to = 'cancelled' and v_actor in ('seller', 'admin')) or
    (v_o.status = 'ready_for_freight' and p_to = 'cancelled' and v_actor in ('seller', 'admin'))
  ) then
    raise exception 'This order can''t move from % to % (%)', replace(v_o.status::text, '_', ' '), replace(p_to::text, '_', ' '), v_actor
      using errcode = 'check_violation';
  end if;

  if p_to = 'cancelled' then
    if v_actor in ('seller', 'admin') and v_note is null then
      raise exception 'Give a reason for cancelling so the buyer understands' using errcode = 'check_violation';
    end if;
    if v_actor = 'buyer' and v_o.status = 'confirmed' and now() > v_o.placed_at + make_interval(mins => v_window) then
      raise exception 'The free cancellation window has passed. Ask the seller to cancel.' using errcode = 'check_violation';
    end if;
  end if;

  v_reserved := v_o.status in ('confirmed', 'fulfilling', 'ready_for_freight');

  -- Confirming reserves stock; cancelling after confirmation releases it.
  if p_to = 'confirmed' then
    for v_item in select product_id, quantity, title from public.order_items where order_id = p_order and product_id is not null loop
      update public.products
         set quantity_available = quantity_available - v_item.quantity
       where id = v_item.product_id and quantity_available >= v_item.quantity;
      if not found then
        raise exception 'Not enough stock of "%" to accept this order. Update your stock or cancel with a reason.', v_item.title
          using errcode = 'check_violation';
      end if;
    end loop;
  elsif p_to = 'cancelled' and v_reserved then
    for v_item in select product_id, quantity from public.order_items where order_id = p_order and product_id is not null loop
      update public.products set quantity_available = quantity_available + v_item.quantity where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
     set status = p_to,
         version = version + 1,
         confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end,
         cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
         cancelled_by = case when p_to = 'cancelled' then v_actor else cancelled_by end,
         cancellation_reason = case when p_to = 'cancelled' then v_note else cancellation_reason end
   where id = p_order;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, v_o.status, p_to, v_uid, v_actor, v_note);

  if p_to = 'confirmed' then
    perform public.issue_proforma(p_order);
  end if;

  if v_actor = 'admin' then
    perform public.write_audit_log('order.admin_transition', 'order', p_order::text,
      jsonb_build_object('order_number', v_o.order_number, 'from', v_o.status, 'to', p_to, 'note', v_note));
  end if;
end;
$$;

revoke execute on function public.addresses_default_guard() from public, anon, authenticated;
revoke execute on function public.addresses_limit() from public, anon, authenticated;
revoke execute on function public.addresses_promote_default() from public, anon, authenticated;
revoke execute on function public.cart_items_guard() from public, anon, authenticated;
grant execute on function public.place_orders(uuid, text, text) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------
alter table public.addresses            enable row level security;
alter table public.cart_items           enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.proforma_invoices    enable row level security;

revoke all on table public.addresses, public.cart_items, public.orders, public.order_items,
  public.order_status_history, public.proforma_invoices from anon, authenticated;
revoke all on sequence public.order_number_seq, public.proforma_number_seq from anon, authenticated;

grant select, delete on table public.addresses to authenticated;
grant insert (profile_id, label, contact_name, contact_phone, county, town, street, landmark, latitude, longitude, is_default)
  on table public.addresses to authenticated;
grant update (label, contact_name, contact_phone, county, town, street, landmark, latitude, longitude, is_default)
  on table public.addresses to authenticated;

grant select, delete on table public.cart_items to authenticated;
grant insert (profile_id, product_id, quantity) on table public.cart_items to authenticated;
grant update (quantity) on table public.cart_items to authenticated;

grant select on table public.orders, public.order_items, public.order_status_history, public.proforma_invoices to authenticated;

grant all on table public.addresses, public.cart_items, public.orders to service_role;
grant select, insert on table public.order_items, public.order_status_history, public.proforma_invoices to service_role;
grant usage on sequence public.order_number_seq, public.proforma_number_seq to service_role;

create policy addresses_own on public.addresses
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy cart_items_own on public.cart_items
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and (select public.has_role('buyer')));

create policy orders_select on public.orders
  for select to authenticated
  using (buyer_id = (select auth.uid())
         or (select public.is_business_member(seller_business_id))
         or (select public.is_admin()));

create policy order_items_select on public.order_items
  for select to authenticated using ((select public.can_view_order(order_id)));
create policy order_status_history_select on public.order_status_history
  for select to authenticated using ((select public.can_view_order(order_id)));
create policy proforma_invoices_select on public.proforma_invoices
  for select to authenticated using ((select public.can_view_order(order_id)));

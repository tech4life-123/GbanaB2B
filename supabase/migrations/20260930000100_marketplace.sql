-- ============================================================================
-- GbanaB2B · Migration 0006 · Marketplace (Phase 2)
-- businesses, business_members, product_categories, products,
-- product_price_tiers, product_specifications, product_images,
-- product_listings view. See docs/database/marketplace.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums & domains
-- ---------------------------------------------------------------------------
create type public.business_type as enum
  ('importer', 'wholesaler', 'distributor', 'manufacturer', 'retailer', 'transport');
create type public.business_verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.business_status as enum ('active', 'suspended', 'closed');
create type public.business_member_role as enum ('owner', 'manager', 'staff');
create type public.product_status as enum ('draft', 'active', 'paused', 'archived');
create type public.packaging_type as enum
  ('bag', 'sack', 'carton', 'box', 'crate', 'drum', 'jerrycan', 'bottle', 'tin',
   'bale', 'bundle', 'roll', 'pallet', 'piece', 'other');

create domain public.lr_county as text check (value in (
  'Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount', 'Grand Gedeh', 'Grand Kru',
  'Lofa', 'Margibi', 'Maryland', 'Montserrado', 'Nimba', 'River Cess', 'River Gee', 'Sinoe'
));

-- URL-safe slug from free text + short random suffix (unique enough; the
-- unique index is the real guarantee and callers retry on conflict).
create or replace function public.make_slug(p_text text)
returns text
language sql
volatile
set search_path = ''
as $$
  select left(
           coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')), ''), 'item'),
           60)
         || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
$$;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  trading_name        text not null check (char_length(btrim(trading_name)) between 2 and 120),
  legal_name          text check (legal_name is null or char_length(btrim(legal_name)) between 2 and 160),
  business_type       public.business_type not null,
  description         text check (description is null or char_length(description) <= 2000),
  county              public.lr_county not null,
  town                text not null check (char_length(btrim(town)) between 2 and 80),
  address_line        text check (address_line is null or char_length(address_line) <= 200),
  contact_phone       text check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_phone      text check (whatsapp_phone is null or whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$'),
  registration_number text check (registration_number is null or char_length(registration_number) <= 60),
  logo_path           text check (logo_path is null or char_length(logo_path) <= 300),
  verification_status public.business_verification_status not null default 'unverified',
  verification_note   text check (verification_note is null or char_length(verification_note) <= 500),
  verified_at         timestamptz,
  status              public.business_status not null default 'active',
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.businesses is 'Trading entities (sellers now; buyers and fleets later). Created via create_business(); verification/status changed only by admins via admin_review_business().';

create index businesses_status_idx on public.businesses (status, verification_status);
create index businesses_county_idx on public.businesses (county) where status = 'active';
create index businesses_created_by_idx on public.businesses (created_by);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- business_members
-- ---------------------------------------------------------------------------
create table public.business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  member_role  public.business_member_role not null,
  created_at   timestamptz not null default now(),
  constraint business_members_unique unique (business_id, profile_id)
);

create index business_members_profile_idx on public.business_members (profile_id);

comment on table public.business_members is 'Who may act for a business. Owners/managers edit listings; staff read-only (later phases).';

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER to avoid RLS recursion).
-- ---------------------------------------------------------------------------
create or replace function public.is_business_member(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    join public.profiles p on p.id = m.profile_id
    where m.business_id = p_business
      and m.profile_id = (select auth.uid())
      and p.status = 'active'
  );
$$;

-- Editor = owner/manager of an ACTIVE business who currently holds the seller role.
create or replace function public.can_edit_business(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('seller') and exists (
    select 1 from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = p_business
      and m.profile_id = (select auth.uid())
      and m.member_role in ('owner', 'manager')
      and b.status = 'active'
  );
$$;

grant execute on function public.is_business_member(uuid) to authenticated, service_role;
grant execute on function public.can_edit_business(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------
create table public.product_categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.product_categories (id) on delete restrict,
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (char_length(btrim(name)) between 2 and 60),
  description  text check (description is null or char_length(description) <= 300),
  icon         text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$'),
  sort_order   integer not null default 100,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint product_categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create index product_categories_parent_idx on public.product_categories (parent_id);

create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

insert into public.product_categories (slug, name, icon, sort_order, description) values
  ('rice-grains',          'Rice & grains',            'wheat',           10, 'Rice, beans, maize, garri and other staples.'),
  ('cooking-oil',          'Cooking oil',              'droplet',         20, 'Vegetable, palm and other edible oils.'),
  ('flour-baking',         'Flour & baking',           'cookie',          30, 'Flour, yeast, baking powder and margarine.'),
  ('sugar-salt-spices',    'Sugar, salt & seasoning',  'soup',            40, 'Sugar, salt, bouillon cubes and spices.'),
  ('canned-packaged-food', 'Canned & packaged food',   'package',         50, 'Tinned fish, tomato paste, noodles, milk powder.'),
  ('frozen-food',          'Frozen food',              'snowflake',       60, 'Frozen chicken, fish and meat.'),
  ('beverages',            'Beverages',                'cup-soda',        70, 'Soft drinks, juice, tea, coffee and malt drinks.'),
  ('water',                'Water',                    'glass-water',     80, 'Bottled and sachet water.'),
  ('toiletries',           'Toiletries & hygiene',     'bath',            90, 'Soap, toothpaste, diapers, sanitary products.'),
  ('household-cleaning',   'Household & cleaning',     'spray-can',      100, 'Detergent, bleach, mops and household goods.'),
  ('building-materials',   'Building materials',       'brick-wall',     110, 'Cement, iron rods, zinc, blocks and timber.'),
  ('hardware-tools',       'Hardware & tools',         'hammer',         120, 'Nails, locks, tools, paint and plumbing.'),
  ('electrical',           'Electrical & solar',       'plug-zap',       130, 'Cables, bulbs, solar panels, batteries.'),
  ('phones-electronics',   'Phones & electronics',     'smartphone',     140, 'Phones, accessories and small electronics.'),
  ('agri-inputs',          'Agricultural inputs',      'sprout',         150, 'Seeds, fertiliser, tools and animal feed.'),
  ('textiles-clothing',    'Textiles & clothing',      'shirt',          160, 'Lappa, fabric, clothing and shoes.'),
  ('stationery-office',    'Stationery & office',      'notebook-pen',   170, 'Exercise books, pens, paper and office supplies.'),
  ('packaging-materials',  'Packaging materials',      'boxes',          180, 'Plastic bags, cartons, bottles and containers.'),
  ('auto-parts',           'Auto & motorbike parts',   'wrench',         190, 'Tyres, oil, filters and spare parts.'),
  ('fuel-lubricants',      'Fuel & lubricants',        'fuel',           200, 'Engine oil, grease and lubricants.');

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete restrict,
  category_id        uuid not null references public.product_categories (id) on delete restrict,
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title              text not null check (char_length(btrim(title)) between 3 and 140),
  description        text check (description is null or char_length(description) <= 5000),
  sku                text check (sku is null or char_length(btrim(sku)) between 1 and 60),
  unit_label         text not null check (char_length(btrim(unit_label)) between 1 and 40),
  packaging_type     public.packaging_type not null default 'other',
  moq                integer not null default 1 check (moq between 1 and 1000000),
  quantity_available integer not null default 0 check (quantity_available between 0 and 100000000),
  currency           public.currency_code not null default 'USD',
  origin_country     text check (origin_country is null or origin_country ~ '^[A-Z]{2}$'),
  -- Logistics (freight engine inputs). Weight required before publishing.
  unit_weight_g      integer check (unit_weight_g is null or unit_weight_g between 1 and 50000000),
  unit_volume_cm3    integer check (unit_volume_cm3 is null or unit_volume_cm3 between 1 and 100000000),
  length_mm          integer check (length_mm is null or length_mm between 1 and 100000),
  width_mm           integer check (width_mm is null or width_mm between 1 and 100000),
  height_mm          integer check (height_mm is null or height_mm between 1 and 100000),
  is_fragile         boolean not null default false,
  is_stackable       boolean not null default true,
  max_stack_layers   smallint check (max_stack_layers is null or max_stack_layers between 1 and 100),
  handling_notes     text check (handling_notes is null or char_length(handling_notes) <= 500),
  status             public.product_status not null default 'draft',
  published_at       timestamptz,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  search_vector      tsvector generated always as (
                       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(sku, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(unit_label, '')), 'B') ||
                       setweight(to_tsvector('english', coalesce(description, '')), 'C')
                     ) stored
);

comment on table public.products is 'Wholesale listings. Price lives in product_price_tiers (set with save_product_pricing). Only active listings of active businesses are public.';
comment on column public.products.unit_label is 'What one unit is, e.g. "25 kg bag" or "carton of 24 x 500 ml". MOQ and tiers count these units.';
comment on column public.products.unit_weight_g is 'Gross weight of one unit in grams, including packaging. Freight is estimated from this.';

create unique index products_business_sku_key on public.products (business_id, lower(sku)) where sku is not null;
create index products_search_idx on public.products using gin (search_vector);
create index products_business_status_idx on public.products (business_id, status);
create index products_category_active_idx on public.products (category_id, published_at desc) where status = 'active';
create index products_active_recent_idx on public.products (published_at desc) where status = 'active';
create index products_created_by_idx on public.products (created_by);

-- ---------------------------------------------------------------------------
-- product_price_tiers — reusable quantity-break pricing. Never hardcoded.
-- ---------------------------------------------------------------------------
create table public.product_price_tiers (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  min_qty           integer not null check (min_qty >= 1),
  max_qty           integer check (max_qty is null or max_qty >= min_qty),
  unit_price_minor  bigint not null check (unit_price_minor between 1 and 100000000000),
  constraint product_price_tiers_unique unique (product_id, min_qty)
);

comment on table public.product_price_tiers is 'Contiguous quantity bands starting at the product MOQ; last band open-ended. Replaced atomically by save_product_pricing().';

-- ---------------------------------------------------------------------------
-- product_specifications
-- ---------------------------------------------------------------------------
create table public.product_specifications (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  value       text not null check (char_length(btrim(value)) between 1 and 200),
  sort_order  smallint not null default 0
);

create index product_specifications_product_idx on public.product_specifications (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- product_images — files live in the public `product-images` bucket under
-- {business_id}/{product_id}/{file}. Rows are what the app displays.
-- ---------------------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  alt_text     text check (alt_text is null or char_length(alt_text) <= 160),
  width        integer check (width is null or width between 1 and 10000),
  height       integer check (height is null or height between 1 and 10000),
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Products: stamp creator & slug, forbid moving between businesses, and
-- enforce what "publishable" means.
create or replace function public.products_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_min integer;
  v_tier_count integer;
begin
  if tg_op = 'INSERT' then
    new.slug := public.make_slug(new.title);
    new.created_by := coalesce((select auth.uid()), new.created_by);
    if new.status <> 'draft' then
      raise exception 'New listings start as drafts' using errcode = 'check_violation';
    end if;
    new.published_at := null;
    return new;
  end if;

  if new.business_id <> old.business_id then
    raise exception 'A listing cannot be moved to another business' using errcode = 'check_violation';
  end if;
  new.slug := old.slug;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if new.status = 'active' and (old.status <> 'active' or new.moq <> old.moq or new.unit_weight_g is distinct from old.unit_weight_g) then
    if new.unit_weight_g is null then
      raise exception 'Add the weight of one unit before publishing' using errcode = 'check_violation';
    end if;
    select count(*), min(min_qty) into v_tier_count, v_first_min
      from public.product_price_tiers where product_id = new.id;
    if v_tier_count = 0 then
      raise exception 'Add at least one price tier before publishing' using errcode = 'check_violation';
    end if;
    if v_first_min <> new.moq then
      raise exception 'The first price tier must start at the minimum order quantity' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.businesses where id = new.business_id and status = 'active') then
      raise exception 'The business is not active' using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'active' and old.status <> 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    raise exception 'Archived listings cannot be reactivated; duplicate it instead' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger products_guard
  before insert or update on public.products
  for each row execute function public.products_guard();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.product_images_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  select business_id into v_business from public.products where id = new.product_id;
  if split_part(new.storage_path, '/', 1) <> v_business::text
     or split_part(new.storage_path, '/', 2) <> new.product_id::text then
    raise exception 'Image path must be {business_id}/{product_id}/file' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.product_images where product_id = new.product_id) >= 8 then
    raise exception 'A listing can have at most 8 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger product_images_limit
  before insert on public.product_images
  for each row execute function public.product_images_limit();

-- ---------------------------------------------------------------------------
-- Workflow functions
-- ---------------------------------------------------------------------------

-- create_business: a seller creates their business and becomes its owner.
-- One owned business per person at launch (see ADR 0007).
create or replace function public.create_business(
  p_trading_name  text,
  p_business_type public.business_type,
  p_county        text,
  p_town          text,
  p_description   text default null,
  p_contact_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
  v_try integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.has_role('seller') then
    raise exception 'Add the seller role to your account before creating a business' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.business_members where profile_id = v_uid and member_role = 'owner') then
    raise exception 'You already own a business on GbanaB2B' using errcode = 'unique_violation';
  end if;

  loop
    begin
      insert into public.businesses (slug, trading_name, business_type, county, town, description, contact_phone, created_by)
      values (public.make_slug(p_trading_name), btrim(p_trading_name), p_business_type, p_county::public.lr_county,
              btrim(p_town), nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_contact_phone, '')), ''), v_uid)
      returning id into v_id;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 3 then raise; end if;
    end;
  end loop;

  insert into public.business_members (business_id, profile_id, member_role) values (v_id, v_uid, 'owner');
  perform public.write_audit_log('business.created', 'business', v_id::text,
                                 jsonb_build_object('trading_name', btrim(p_trading_name)));
  return v_id;
end;
$$;

-- save_product_pricing: set MOQ and the full tier table in one transaction.
-- p_tiers: [{"min_qty":10,"max_qty":49,"unit_price_minor":2450}, ... , {"min_qty":100,"max_qty":null,...}]
create or replace function public.save_product_pricing(p_product uuid, p_moq integer, p_currency public.currency_code, p_tiers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_status public.product_status;
  v_count integer;
  v_prev_max integer;
  v_tier jsonb;
  v_min integer;
  v_max integer;
  v_price bigint;
  v_i integer := 0;
begin
  select business_id, status into v_business, v_status from public.products where id = p_product for update;
  if v_business is null or not public.can_edit_business(v_business) then
    raise exception 'You cannot edit this listing' using errcode = 'insufficient_privilege';
  end if;
  if p_moq is null or p_moq < 1 or p_moq > 1000000 then
    raise exception 'Minimum order must be between 1 and 1,000,000' using errcode = 'check_violation';
  end if;
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' then
    raise exception 'Price tiers must be a list' using errcode = 'check_violation';
  end if;
  v_count := jsonb_array_length(p_tiers);
  if v_count < 1 or v_count > 10 then
    raise exception 'Add between 1 and 10 price tiers' using errcode = 'check_violation';
  end if;

  for v_tier in select value from jsonb_array_elements(p_tiers) loop
    v_i := v_i + 1;
    v_min := (v_tier ->> 'min_qty')::integer;
    v_max := nullif(v_tier ->> 'max_qty', '')::integer;
    v_price := (v_tier ->> 'unit_price_minor')::bigint;
    if v_min is null or v_price is null or v_price < 1 or v_price > 100000000000 then
      raise exception 'Tier % needs a quantity and a price above zero', v_i using errcode = 'check_violation';
    end if;
    if v_i = 1 and v_min <> p_moq then
      raise exception 'The first tier must start at the minimum order (%)', p_moq using errcode = 'check_violation';
    end if;
    if v_i > 1 and v_min <> v_prev_max + 1 then
      raise exception 'Tier % must start at % (right after the previous tier)', v_i, v_prev_max + 1 using errcode = 'check_violation';
    end if;
    if v_i < v_count and (v_max is null or v_max < v_min) then
      raise exception 'Tier % needs an upper quantity of at least %', v_i, v_min using errcode = 'check_violation';
    end if;
    if v_i = v_count and v_max is not null then
      raise exception 'The last tier must be open-ended (no upper quantity)' using errcode = 'check_violation';
    end if;
    v_prev_max := v_max;
  end loop;

  delete from public.product_price_tiers where product_id = p_product;
  insert into public.product_price_tiers (product_id, min_qty, max_qty, unit_price_minor)
  select p_product, (t ->> 'min_qty')::integer, nullif(t ->> 'max_qty', '')::integer, (t ->> 'unit_price_minor')::bigint
    from jsonb_array_elements(p_tiers) t;

  -- Trigger re-validates an active listing against the new MOQ.
  update public.products set moq = p_moq, currency = p_currency where id = p_product;
end;
$$;

-- save_product_specifications: replace the spec sheet atomically.
create or replace function public.save_product_specifications(p_product uuid, p_specs jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  select business_id into v_business from public.products where id = p_product;
  if v_business is null or not public.can_edit_business(v_business) then
    raise exception 'You cannot edit this listing' using errcode = 'insufficient_privilege';
  end if;
  if p_specs is null or jsonb_typeof(p_specs) <> 'array' or jsonb_array_length(p_specs) > 30 then
    raise exception 'Add up to 30 specifications' using errcode = 'check_violation';
  end if;
  delete from public.product_specifications where product_id = p_product;
  insert into public.product_specifications (product_id, label, value, sort_order)
  select p_product, btrim(s ->> 'label'), btrim(s ->> 'value'), (ord - 1)::smallint
    from jsonb_array_elements(p_specs) with ordinality as x(s, ord)
   where coalesce(btrim(s ->> 'label'), '') <> '' and coalesce(btrim(s ->> 'value'), '') <> '';
end;
$$;

-- admin_review_business: verification + status, audited.
create or replace function public.admin_review_business(
  p_business uuid,
  p_verification public.business_verification_status,
  p_status public.business_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.businesses%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review businesses' using errcode = 'insufficient_privilege';
  end if;
  select * into v_old from public.businesses where id = p_business for update;
  if not found then
    raise exception 'Business not found' using errcode = 'no_data_found';
  end if;
  if p_verification = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Give a reason when rejecting verification' using errcode = 'check_violation';
  end if;

  update public.businesses
     set verification_status = p_verification,
         status = p_status,
         verification_note = nullif(btrim(coalesce(p_note, '')), ''),
         verified_at = case when p_verification = 'verified' then coalesce(v_old.verified_at, now()) else null end
   where id = p_business;

  -- Suspending a business takes its listings off the market.
  if p_status <> 'active' and v_old.status = 'active' then
    update public.products set status = 'paused' where business_id = p_business and status = 'active';
  end if;

  perform public.write_audit_log('business.reviewed', 'business', p_business::text,
    jsonb_build_object('old_verification', v_old.verification_status, 'new_verification', p_verification,
                       'old_status', v_old.status, 'new_status', p_status, 'note', p_note));
end;
$$;

-- Category changes are audited automatically.
create or replace function public.audit_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit_log(
    case when tg_op = 'INSERT' then 'category.created' else 'category.updated' end,
    'product_category', new.id::text,
    jsonb_build_object('name', new.name, 'slug', new.slug, 'is_active', new.is_active));
  return new;
end;
$$;

create trigger product_categories_audit
  after insert or update on public.product_categories
  for each row execute function public.audit_category_change();

revoke execute on function public.products_guard() from public, anon, authenticated;
revoke execute on function public.product_images_limit() from public, anon, authenticated;
revoke execute on function public.audit_category_change() from public, anon, authenticated;
revoke execute on function public.make_slug(text) from public, anon, authenticated;

grant execute on function public.create_business(text, public.business_type, text, text, text, text) to authenticated;
grant execute on function public.save_product_pricing(uuid, integer, public.currency_code, jsonb) to authenticated;
grant execute on function public.save_product_specifications(uuid, jsonb) to authenticated;
grant execute on function public.admin_review_business(uuid, public.business_verification_status, public.business_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Read model for browsing (security_invoker: underlying RLS applies).
-- ---------------------------------------------------------------------------
create view public.product_listings
with (security_invoker = true)
as
select
  p.id, p.slug, p.title, p.unit_label, p.packaging_type, p.moq, p.quantity_available,
  p.currency, p.status, p.published_at, p.unit_weight_g, p.origin_country, p.search_vector,
  p.category_id, c.slug as category_slug, c.name as category_name,
  p.business_id, b.slug as business_slug, b.trading_name as business_name,
  b.county as business_county, b.town as business_town, b.verification_status as business_verification,
  t.min_price_minor, t.moq_price_minor, t.tier_count,
  (select i.storage_path from public.product_images i where i.product_id = p.id
     order by i.sort_order, i.created_at limit 1) as cover_image_path
from public.products p
join public.businesses b on b.id = p.business_id
join public.product_categories c on c.id = p.category_id
left join lateral (
  select min(pt.unit_price_minor) as min_price_minor,
         (array_agg(pt.unit_price_minor order by pt.min_qty))[1] as moq_price_minor,
         count(*)::integer as tier_count
    from public.product_price_tiers pt where pt.product_id = p.id
) t on true;

comment on view public.product_listings is 'Browse/search read model. security_invoker so visibility follows products/businesses RLS.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
alter table public.businesses             enable row level security;
alter table public.business_members       enable row level security;
alter table public.product_categories     enable row level security;
alter table public.products               enable row level security;
alter table public.product_price_tiers    enable row level security;
alter table public.product_specifications enable row level security;
alter table public.product_images         enable row level security;

revoke all on table public.businesses, public.business_members, public.product_categories, public.products,
  public.product_price_tiers, public.product_specifications, public.product_images, public.product_listings
  from anon, authenticated;

grant select on table public.businesses, public.product_categories, public.products,
  public.product_price_tiers, public.product_specifications, public.product_images, public.product_listings
  to anon, authenticated;
grant select on table public.business_members to authenticated;

grant update (trading_name, legal_name, business_type, description, county, town, address_line,
              contact_phone, whatsapp_phone, registration_number, logo_path)
  on table public.businesses to authenticated;

grant insert (business_id, category_id, title, description, sku, unit_label, packaging_type, moq,
              quantity_available, currency, origin_country, unit_weight_g, unit_volume_cm3,
              length_mm, width_mm, height_mm, is_fragile, is_stackable, max_stack_layers, handling_notes)
  on table public.products to authenticated;
grant update (category_id, title, description, sku, unit_label, packaging_type, quantity_available,
              origin_country, unit_weight_g, unit_volume_cm3, length_mm, width_mm, height_mm,
              is_fragile, is_stackable, max_stack_layers, handling_notes, status)
  on table public.products to authenticated;
grant delete on table public.products to authenticated;

grant insert (product_id, storage_path, alt_text, width, height, sort_order) on table public.product_images to authenticated;
grant update (alt_text, sort_order) on table public.product_images to authenticated;
grant delete on table public.product_images to authenticated;

grant insert (parent_id, slug, name, description, icon, sort_order, is_active) on table public.product_categories to authenticated;
grant update (parent_id, name, description, icon, sort_order, is_active) on table public.product_categories to authenticated;

grant all on table public.businesses, public.business_members, public.product_categories, public.products,
  public.product_price_tiers, public.product_specifications, public.product_images to service_role;
grant select on table public.product_listings to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- businesses: active businesses are public; members and admins see their own/all.
create policy businesses_select_anon on public.businesses
  for select to anon using (status = 'active');
create policy businesses_select on public.businesses
  for select to authenticated
  using (status = 'active' or (select public.is_business_member(id)) or (select public.is_admin()));
create policy businesses_update on public.businesses
  for update to authenticated
  using ((select public.can_edit_business(id)))
  with check ((select public.can_edit_business(id)));

-- business_members: visible to fellow members and admins.
create policy business_members_select on public.business_members
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_business_member(business_id)) or (select public.is_admin()));

-- categories: active ones are public; admins see and manage all.
create policy product_categories_select_anon on public.product_categories
  for select to anon using (is_active);
create policy product_categories_select on public.product_categories
  for select to authenticated using (is_active or (select public.is_admin()));
create policy product_categories_insert on public.product_categories
  for insert to authenticated with check ((select public.is_admin()));
create policy product_categories_update on public.product_categories
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- products: active listings of active businesses are public; editors manage theirs.
create policy products_select_anon on public.products
  for select to anon
  using (status = 'active' and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active'));
create policy products_select on public.products
  for select to authenticated
  using (
    (status = 'active' and exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active'))
    or (select public.is_business_member(business_id))
    or (select public.is_admin())
  );
create policy products_insert on public.products
  for insert to authenticated with check ((select public.can_edit_business(business_id)));
create policy products_update on public.products
  for update to authenticated
  using ((select public.can_edit_business(business_id)))
  with check ((select public.can_edit_business(business_id)));
create policy products_delete on public.products
  for delete to authenticated
  using (status = 'draft' and (select public.can_edit_business(business_id)));

-- Child tables follow product visibility (the subquery is itself filtered by products RLS).
create policy product_price_tiers_select on public.product_price_tiers
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy product_specifications_select on public.product_specifications
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy product_images_select on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));

create policy product_images_insert on public.product_images
  for insert to authenticated
  with check (exists (select 1 from public.products p where p.id = product_id and public.can_edit_business(p.business_id)));
create policy product_images_update on public.product_images
  for update to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and public.can_edit_business(p.business_id)))
  with check (exists (select 1 from public.products p where p.id = product_id and public.can_edit_business(p.business_id)));
create policy product_images_delete on public.product_images
  for delete to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and public.can_edit_business(p.business_id)));

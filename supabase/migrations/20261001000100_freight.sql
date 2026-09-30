-- ============================================================================
-- GbanaB2B · Migration 0011 · Freight exchange (Phase 4)
-- Carrier profiles, vehicles, private verification documents, admin
-- verification, freight RFQs, sealed bids and carrier assignment.
-- See docs/database/freight.md.
-- ============================================================================

create type public.carrier_verification_status as enum ('pending', 'under_review', 'verified', 'rejected', 'suspended');
create type public.vehicle_type as enum ('motorbike', 'tricycle', 'pickup', 'van', 'box_truck', 'flatbed_truck', 'tipper', 'container_truck', 'other');
create type public.vehicle_class as enum ('small', 'medium', 'large');
create type public.carrier_document_type as enum ('driver_license', 'national_id', 'passport', 'vehicle_registration', 'vehicle_insurance', 'other');
create type public.freight_rfq_status as enum ('open', 'awarded', 'cancelled', 'expired');
create type public.freight_bid_status as enum ('submitted', 'withdrawn', 'accepted', 'rejected', 'expired');

insert into public.platform_settings (key, value, description, is_sensitive, min_value, max_value) values
  ('freight.max_vehicles_per_carrier', '10', 'Vehicles one carrier account may register.', false, 1, 100)
on conflict (key) do nothing;

-- Weight class used for display and matching hints. Capacity checks always use the numeric payload.
create or replace function public.vehicle_class_for(p_kg numeric)
returns public.vehicle_class
language sql
immutable
set search_path = ''
as $$
  select case when p_kg <= 300 then 'small'::public.vehicle_class
              when p_kg <= 3000 then 'medium'::public.vehicle_class
              else 'large'::public.vehicle_class end;
$$;
grant execute on function public.vehicle_class_for(numeric) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- carrier_profiles — one per carrier account (id = profiles.id)
-- ---------------------------------------------------------------------------
create table public.carrier_profiles (
  id                   uuid primary key references public.profiles (id) on delete cascade,
  full_name            text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone                text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  address              text not null check (char_length(btrim(address)) between 3 and 200),
  home_county          public.lr_county not null,
  home_town            text not null check (char_length(btrim(home_town)) between 2 and 80),
  coverage_counties    text[] not null check (
    cardinality(coverage_counties) between 1 and 15
    and coverage_counties <@ array['Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount', 'Grand Gedeh', 'Grand Kru',
      'Lofa', 'Margibi', 'Maryland', 'Montserrado', 'Nimba', 'River Cess', 'River Gee', 'Sinoe']::text[]),
  is_available         boolean not null default true,
  verification_status  public.carrier_verification_status not null default 'pending',
  verification_note    text check (verification_note is null or char_length(verification_note) <= 500),
  submitted_at         timestamptz,
  reviewed_at          timestamptz,
  reviewed_by          uuid references public.profiles (id) on delete set null,
  verified_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.carrier_profiles is 'Driver/fleet operator details. verification_status changes only through submit_carrier_for_review() and admin_review_carrier().';

create index carrier_profiles_status_idx on public.carrier_profiles (verification_status);
create index carrier_profiles_reviewed_by_idx on public.carrier_profiles (reviewed_by);
create index carrier_profiles_coverage_idx on public.carrier_profiles using gin (coverage_counties);

create trigger carrier_profiles_set_updated_at
  before update on public.carrier_profiles
  for each row execute function public.set_updated_at();

-- Changing the verified identity (name or phone) sends the carrier back to review.
create or replace function public.carrier_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.user_roles where user_id = new.id and role = 'carrier' and status = 'active') then
      raise exception 'Add the carrier role to your account first' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;
  if old.verification_status = 'verified'
     and (new.full_name is distinct from old.full_name or new.phone is distinct from old.phone)
     and new.verification_status = 'verified' then
    new.verification_status := 'under_review';
    new.submitted_at := now();
    new.verification_note := 'Name or phone changed — re-checking.';
  end if;
  return new;
end;
$$;

create trigger carrier_profiles_guard
  before insert or update on public.carrier_profiles
  for each row execute function public.carrier_profiles_guard();

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id               uuid primary key default gen_random_uuid(),
  carrier_id       uuid not null references public.carrier_profiles (id) on delete cascade,
  vehicle_type     public.vehicle_type not null,
  plate_number     text not null check (plate_number ~ '^[A-Z0-9-]{3,12}$'),
  make_model       text check (make_model is null or char_length(make_model) <= 80),
  year             integer check (year is null or year between 1970 and 2100),
  payload_kg       integer not null check (payload_kg between 1 and 60000),
  cargo_volume_m3  numeric(6,2) check (cargo_volume_m3 is null or cargo_volume_m3 > 0),
  vehicle_class    public.vehicle_class generated always as (public.vehicle_class_for(payload_kg)) stored,
  is_active        boolean not null default true,
  is_verified      boolean not null default false,
  verified_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint vehicles_plate_unique unique (plate_number)
);

comment on column public.vehicles.payload_kg is 'Maximum payload. Matching always compares this number to the cargo weight — the class is only a label.';

create index vehicles_carrier_idx on public.vehicles (carrier_id);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

create or replace function public.vehicles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'freight.max_vehicles_per_carrier'), 10);
begin
  new.plate_number := upper(regexp_replace(btrim(new.plate_number), '\s+', '', 'g'));
  if tg_op = 'INSERT' then
    if (select count(*) from public.vehicles where carrier_id = new.carrier_id) >= v_max then
      raise exception 'You can register up to % vehicles', v_max using errcode = 'check_violation';
    end if;
    new.is_verified := false;
    new.verified_at := null;
  elsif (new.plate_number, new.payload_kg, new.vehicle_type, new.cargo_volume_m3)
        is distinct from (old.plate_number, old.payload_kg, old.vehicle_type, old.cargo_volume_m3)
        and not public.is_admin() then
    -- Anything that affects matching must be re-checked by an admin.
    new.is_verified := false;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

create trigger vehicles_guard
  before insert or update on public.vehicles
  for each row execute function public.vehicles_guard();

-- ---------------------------------------------------------------------------
-- carrier_documents — metadata for files in the PRIVATE carrier-documents bucket
-- ---------------------------------------------------------------------------
create table public.carrier_documents (
  id            uuid primary key default gen_random_uuid(),
  carrier_id    uuid not null references public.carrier_profiles (id) on delete cascade,
  vehicle_id    uuid references public.vehicles (id) on delete set null,
  doc_type      public.carrier_document_type not null,
  storage_path  text not null unique,
  file_name     text not null check (char_length(file_name) between 1 and 160),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes    integer not null check (size_bytes between 1 and 5242880),
  uploaded_at   timestamptz not null default now()
);

create index carrier_documents_carrier_idx on public.carrier_documents (carrier_id);
create index carrier_documents_vehicle_idx on public.carrier_documents (vehicle_id);

create or replace function public.carrier_documents_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.carrier_verification_status;
begin
  if tg_op = 'INSERT' then
    if new.storage_path !~ ('^' || new.carrier_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$') then
      raise exception 'Invalid document path' using errcode = 'check_violation';
    end if;
    if new.vehicle_id is not null and not exists (select 1 from public.vehicles where id = new.vehicle_id and carrier_id = new.carrier_id) then
      raise exception 'That vehicle is not yours' using errcode = 'check_violation';
    end if;
    if (select count(*) from public.carrier_documents where carrier_id = new.carrier_id) >= 30 then
      raise exception 'Too many documents — delete old ones first' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  -- DELETE: evidence behind a verification decision is kept.
  select verification_status into v_status from public.carrier_profiles where id = old.carrier_id;
  if v_status in ('verified', 'suspended') and not public.is_admin() then
    raise exception 'Documents of a verified carrier are kept on file' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger carrier_documents_guard
  before insert or delete on public.carrier_documents
  for each row execute function public.carrier_documents_guard();

create trigger carrier_documents_immutable
  before update on public.carrier_documents
  for each row execute function public.prevent_mutation();

-- Private bucket: never public; files are served to admins through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carrier-documents', 'carrier-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.owns_carrier_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(coalesce(p_name, ''), '/', 1) = coalesce((select auth.uid())::text, '-')
     and public.has_role('carrier');
$$;

revoke execute on function public.owns_carrier_object(text) from public, anon;
grant execute on function public.owns_carrier_object(text) to authenticated, service_role;

create policy carrier_documents_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'carrier-documents' and public.owns_carrier_object(name));

create policy carrier_documents_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'carrier-documents' and (public.owns_carrier_object(name) or public.is_admin()));

create policy carrier_documents_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'carrier-documents' and public.owns_carrier_object(name));

-- ---------------------------------------------------------------------------
-- freight_rfqs — a request for freight quotes on one order
-- ---------------------------------------------------------------------------
create sequence public.freight_rfq_number_seq start 1001;

create table public.freight_rfqs (
  id                       uuid primary key default gen_random_uuid(),
  rfq_number               text not null unique,
  order_id                 uuid not null references public.orders (id) on delete restrict,
  created_by               uuid references public.profiles (id) on delete set null,
  created_by_role          text not null check (created_by_role in ('buyer', 'seller', 'admin')),
  status                   public.freight_rfq_status not null default 'open',
  currency                 public.currency_code not null,
  pickup_county            public.lr_county not null,
  pickup_town              text not null,
  pickup_area              text,
  destination_county       public.lr_county not null,
  destination_town         text not null,
  destination_landmark     text,
  cargo_weight_g           bigint not null check (cargo_weight_g > 0),
  cargo_volume_cm3         bigint check (cargo_volume_cm3 is null or cargo_volume_cm3 > 0),
  package_count            integer not null check (package_count between 1 and 1000000),
  required_class           public.vehicle_class not null,
  is_fragile               boolean not null default false,
  is_stackable             boolean not null default true,
  cargo_summary            text not null,
  handling_notes           text check (handling_notes is null or char_length(handling_notes) <= 1000),
  pickup_date              date not null,
  preferred_delivery_date  date,
  special_instructions     text check (special_instructions is null or char_length(special_instructions) <= 500),
  closes_at                timestamptz not null,
  awarded_bid_id           uuid,
  cancelled_reason         text check (cancelled_reason is null or char_length(cancelled_reason) <= 500),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint freight_rfqs_dates check (preferred_delivery_date is null or preferred_delivery_date >= pickup_date)
);

comment on table public.freight_rfqs is 'Holds only what a carrier needs to price the job — no buyer/seller names or phone numbers. Contacts reach the carrier through carrier_assignments after selection.';

create unique index freight_rfqs_one_live_per_order on public.freight_rfqs (order_id) where status in ('open', 'awarded');
create index freight_rfqs_order_idx on public.freight_rfqs (order_id);
create index freight_rfqs_board_idx on public.freight_rfqs (status, closes_at);
create index freight_rfqs_created_by_idx on public.freight_rfqs (created_by);

create trigger freight_rfqs_set_updated_at
  before update on public.freight_rfqs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- freight_bids — sealed: a carrier only ever sees their own
-- ---------------------------------------------------------------------------
create table public.freight_bids (
  id                      uuid primary key default gen_random_uuid(),
  rfq_id                  uuid not null references public.freight_rfqs (id) on delete cascade,
  carrier_id              uuid not null references public.carrier_profiles (id) on delete restrict,
  vehicle_id              uuid not null references public.vehicles (id) on delete restrict,
  amount_minor            bigint not null check (amount_minor between 1 and 100000000000),
  currency                public.currency_code not null,
  eta_hours               integer not null check (eta_hours between 1 and 720),
  proposed_delivery_date  date not null,
  note                    text check (note is null or char_length(note) <= 300),
  status                  public.freight_bid_status not null default 'submitted',
  carrier_name            text not null,
  vehicle_type            public.vehicle_type not null,
  vehicle_class           public.vehicle_class not null,
  payload_kg              integer not null,
  submitted_at            timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  decided_at              timestamptz,
  constraint freight_bids_one_per_carrier unique (rfq_id, carrier_id)
);

comment on table public.freight_bids is 'Written only by submit_freight_bid / withdraw_freight_bid / select_freight_bid. RLS: carriers see their own rows; the order''s buyer and admins see all bids on an RFQ.';

create index freight_bids_carrier_idx on public.freight_bids (carrier_id, submitted_at desc);
create index freight_bids_vehicle_idx on public.freight_bids (vehicle_id);

create trigger freight_bids_set_updated_at
  before update on public.freight_bids
  for each row execute function public.set_updated_at();

alter table public.freight_rfqs
  add constraint freight_rfqs_awarded_bid_fkey foreign key (awarded_bid_id) references public.freight_bids (id) on delete restrict;
create index freight_rfqs_awarded_bid_idx on public.freight_rfqs (awarded_bid_id);

-- ---------------------------------------------------------------------------
-- carrier_assignments — the explicit award, with the contacts the driver needs
-- ---------------------------------------------------------------------------
create table public.carrier_assignments (
  id                      uuid primary key default gen_random_uuid(),
  rfq_id                  uuid not null unique references public.freight_rfqs (id) on delete restrict,
  order_id                uuid not null references public.orders (id) on delete restrict,
  bid_id                  uuid not null unique references public.freight_bids (id) on delete restrict,
  carrier_id              uuid not null references public.carrier_profiles (id) on delete restrict,
  vehicle_id              uuid not null references public.vehicles (id) on delete restrict,
  amount_minor            bigint not null check (amount_minor > 0),
  currency                public.currency_code not null,
  eta_hours               integer not null,
  proposed_delivery_date  date not null,
  carrier_snapshot        jsonb not null check (jsonb_typeof(carrier_snapshot) = 'object'),
  pickup_snapshot         jsonb not null check (jsonb_typeof(pickup_snapshot) = 'object'),
  dropoff_snapshot        jsonb not null check (jsonb_typeof(dropoff_snapshot) = 'object'),
  status                  text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  assigned_by             uuid references public.profiles (id) on delete set null,
  assigned_at             timestamptz not null default now(),
  cancelled_at            timestamptz
);

create index carrier_assignments_order_idx on public.carrier_assignments (order_id);
create index carrier_assignments_carrier_idx on public.carrier_assignments (carrier_id, assigned_at desc);
create index carrier_assignments_vehicle_idx on public.carrier_assignments (vehicle_id);
create index carrier_assignments_assigned_by_idx on public.carrier_assignments (assigned_by);

-- ---------------------------------------------------------------------------
-- Eligibility
-- ---------------------------------------------------------------------------
create or replace function public.is_verified_carrier(p_carrier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.carrier_profiles c
      join public.profiles p on p.id = c.id
      join public.user_roles r on r.user_id = c.id and r.role = 'carrier' and r.status = 'active'
     where c.id = p_carrier and c.verification_status = 'verified' and p.status = 'active'
  );
$$;

-- A verified, active vehicle of this carrier that can carry this RFQ's cargo.
create or replace function public.vehicle_fits_rfq(p_vehicle uuid, p_rfq uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v, public.freight_rfqs r
     where v.id = p_vehicle and r.id = p_rfq
       and v.is_active and v.is_verified
       and v.payload_kg::bigint * 1000 >= r.cargo_weight_g
       and (r.cargo_volume_cm3 is null or v.cargo_volume_m3 is null or v.cargo_volume_m3 * 1000000 >= r.cargo_volume_cm3)
  );
$$;

-- True when the carrier may see and bid on the RFQ right now.
create or replace function public.carrier_eligible_for_rfq(p_rfq uuid, p_carrier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.freight_rfqs r
      join public.orders o on o.id = r.order_id
      join public.carrier_profiles c on c.id = p_carrier
     where r.id = p_rfq
       and r.status = 'open' and r.closes_at > now()
       and c.is_available
       and public.is_verified_carrier(c.id)
       and r.pickup_county::text = any (c.coverage_counties)
       and r.destination_county::text = any (c.coverage_counties)
       and o.buyer_id <> c.id
       and not exists (select 1 from public.business_members m where m.business_id = o.seller_business_id and m.profile_id = c.id)
       and exists (select 1 from public.vehicles v where v.carrier_id = c.id and public.vehicle_fits_rfq(v.id, r.id))
  );
$$;

-- Row visibility for carriers: eligible now, or they already bid on it.
create or replace function public.carrier_can_see_rfq(p_rfq uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.freight_bids b where b.rfq_id = p_rfq and b.carrier_id = (select auth.uid()))
    or public.carrier_eligible_for_rfq(p_rfq, (select auth.uid()))
  );
$$;

create or replace function public.is_rfq_buyer(p_rfq uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.freight_rfqs r join public.orders o on o.id = r.order_id
     where r.id = p_rfq and o.buyer_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Verification workflow
-- ---------------------------------------------------------------------------
create or replace function public.submit_carrier_for_review()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c public.carrier_profiles%rowtype;
begin
  if not public.has_role('carrier') then
    raise exception 'Add the carrier role to your account first' using errcode = 'insufficient_privilege';
  end if;
  select * into v_c from public.carrier_profiles where id = v_uid for update;
  if not found then
    raise exception 'Complete your driver profile first' using errcode = 'check_violation';
  end if;
  if v_c.verification_status not in ('pending', 'rejected') then
    raise exception 'Your profile is already %', replace(v_c.verification_status::text, '_', ' ') using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.vehicles where carrier_id = v_uid and is_active) then
    raise exception 'Add at least one vehicle' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.carrier_documents where carrier_id = v_uid and doc_type = 'driver_license') then
    raise exception 'Upload your driver''s licence' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.carrier_documents where carrier_id = v_uid and doc_type in ('national_id', 'passport')) then
    raise exception 'Upload your national ID or passport' using errcode = 'check_violation';
  end if;
  update public.carrier_profiles
     set verification_status = 'under_review', submitted_at = now(), verification_note = null
   where id = v_uid;
end;
$$;

create or replace function public.admin_review_carrier(
  p_carrier uuid,
  p_status public.carrier_verification_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.carrier_profiles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review carriers' using errcode = 'insufficient_privilege';
  end if;
  select * into v_c from public.carrier_profiles where id = p_carrier for update;
  if not found then
    raise exception 'Carrier not found' using errcode = 'no_data_found';
  end if;
  if p_carrier = (select auth.uid()) then
    raise exception 'You cannot review your own carrier profile' using errcode = 'insufficient_privilege';
  end if;
  if not (
    (v_c.verification_status = 'under_review' and p_status in ('verified', 'rejected')) or
    (v_c.verification_status = 'verified' and p_status = 'suspended') or
    (v_c.verification_status = 'suspended' and p_status in ('verified', 'rejected'))
  ) then
    raise exception 'A % carrier can''t be marked %', replace(v_c.verification_status::text, '_', ' '), p_status
      using errcode = 'check_violation';
  end if;
  if p_status in ('rejected', 'suspended') and v_note is null then
    raise exception 'Give a reason the carrier can act on' using errcode = 'check_violation';
  end if;
  if p_status = 'verified' and not exists (select 1 from public.vehicles where carrier_id = p_carrier and is_verified and is_active) then
    raise exception 'Verify at least one of their vehicles first' using errcode = 'check_violation';
  end if;

  update public.carrier_profiles
     set verification_status = p_status,
         verification_note = v_note,
         reviewed_at = now(),
         reviewed_by = (select auth.uid()),
         verified_at = case when p_status = 'verified' then now() else verified_at end
   where id = p_carrier;

  -- A carrier who is no longer verified can't win jobs: close their open bids.
  if p_status <> 'verified' then
    update public.freight_bids b
       set status = 'withdrawn', decided_at = now()
     where b.carrier_id = p_carrier and b.status = 'submitted';
  end if;

  perform public.write_audit_log('carrier.' || p_status::text, 'carrier_profile', p_carrier::text,
    jsonb_build_object('from', v_c.verification_status, 'to', p_status, 'note', v_note, 'name', v_c.full_name));
end;
$$;

create or replace function public.admin_set_vehicle_verified(p_vehicle uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.vehicles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can verify vehicles' using errcode = 'insufficient_privilege';
  end if;
  select * into v_v from public.vehicles where id = p_vehicle for update;
  if not found then
    raise exception 'Vehicle not found' using errcode = 'no_data_found';
  end if;
  if v_v.carrier_id = (select auth.uid()) then
    raise exception 'You cannot verify your own vehicle' using errcode = 'insufficient_privilege';
  end if;
  update public.vehicles set is_verified = p_verified, verified_at = case when p_verified then now() else null end where id = p_vehicle;
  perform public.write_audit_log(case when p_verified then 'vehicle.verified' else 'vehicle.unverified' end, 'vehicle', p_vehicle::text,
    jsonb_build_object('plate', v_v.plate_number, 'payload_kg', v_v.payload_kg, 'carrier', v_v.carrier_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- RFQ lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.create_freight_rfq(
  p_order uuid,
  p_pickup_date date,
  p_preferred_delivery_date date default null,
  p_package_count integer default null,
  p_special_instructions text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_o public.orders%rowtype;
  v_b public.businesses%rowtype;
  v_role text;
  v_hours integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'freight.bid_expiry_hours'), 48);
  v_volume bigint;
  v_missing_volume boolean;
  v_fragile boolean;
  v_stackable boolean;
  v_notes text;
  v_summary text;
  v_packages integer;
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_special_instructions, '')), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;
  if public.can_edit_business(v_o.seller_business_id) then
    v_role := 'seller';
  elsif v_o.buyer_id = v_uid and public.has_role('buyer') then
    v_role := 'buyer';
  else
    raise exception 'Only the buyer or seller can request freight for this order' using errcode = 'insufficient_privilege';
  end if;
  if v_o.status <> 'ready_for_freight' then
    raise exception 'Freight can be requested once the seller marks the order ready for pickup' using errcode = 'check_violation';
  end if;
  if p_pickup_date is null or p_pickup_date < current_date then
    raise exception 'Choose a pickup date from today onwards' using errcode = 'check_violation';
  end if;
  if p_preferred_delivery_date is not null and p_preferred_delivery_date < p_pickup_date then
    raise exception 'Delivery can''t be before pickup' using errcode = 'check_violation';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep instructions under 500 characters' using errcode = 'check_violation';
  end if;
  select * into v_b from public.businesses where id = v_o.seller_business_id;

  -- Cargo from the order snapshot; volume/handling from the listings (best available data).
  select coalesce(sum(i.quantity::bigint * p.unit_volume_cm3), 0),
         bool_or(p.id is null or p.unit_volume_cm3 is null),
         coalesce(bool_or(p.is_fragile), false),
         coalesce(bool_and(p.is_stackable), true),
         string_agg(nullif(btrim(p.handling_notes), ''), ' · '),
         string_agg(i.quantity || ' × ' || i.unit_label || ' ' || i.title, '; ' order by i.title),
         sum(i.quantity)
    into v_volume, v_missing_volume, v_fragile, v_stackable, v_notes, v_summary, v_packages
    from public.order_items i left join public.products p on p.id = i.product_id
   where i.order_id = p_order;

  insert into public.freight_rfqs (
    rfq_number, order_id, created_by, created_by_role, currency,
    pickup_county, pickup_town, pickup_area,
    destination_county, destination_town, destination_landmark,
    cargo_weight_g, cargo_volume_cm3, package_count, required_class, is_fragile, is_stackable,
    cargo_summary, handling_notes, pickup_date, preferred_delivery_date, special_instructions, closes_at)
  values (
    'FR-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.freight_rfq_number_seq')::text, 6, '0'),
    p_order, v_uid, v_role, v_o.currency,
    v_b.county, v_b.town, v_b.address_line,
    (v_o.delivery_address ->> 'county'), (v_o.delivery_address ->> 'town'), (v_o.delivery_address ->> 'landmark'),
    v_o.total_weight_g, case when v_missing_volume then null else nullif(v_volume, 0) end,
    greatest(1, coalesce(p_package_count, least(v_packages, 1000000))),
    public.vehicle_class_for(v_o.total_weight_g / 1000.0), v_fragile, v_stackable,
    left(v_summary, 1000), left(v_notes, 1000), p_pickup_date, p_preferred_delivery_date, v_note,
    now() + make_interval(hours => v_hours))
  returning id into v_id;

  update public.orders set status = 'freight_requested', version = version + 1 where id = p_order;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order, 'ready_for_freight', 'freight_requested', v_uid, v_role, 'Freight requested');
  return v_id;
end;
$$;

-- Closes an RFQ without an award and returns the order to "ready for pickup".
create or replace function public.cancel_freight_rfq(p_rfq uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_r public.freight_rfqs%rowtype;
  v_o public.orders%rowtype;
  v_role text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_r from public.freight_rfqs where id = p_rfq for update;
  if not found then
    raise exception 'Freight request not found' using errcode = 'no_data_found';
  end if;
  select * into v_o from public.orders where id = v_r.order_id for update;
  if public.can_edit_business(v_o.seller_business_id) then v_role := 'seller';
  elsif v_o.buyer_id = v_uid and public.has_role('buyer') then v_role := 'buyer';
  elsif public.is_admin() then v_role := 'admin';
  else
    raise exception 'You cannot change this freight request' using errcode = 'insufficient_privilege';
  end if;
  if v_r.status <> 'open' then
    raise exception 'This freight request is already %', v_r.status using errcode = 'check_violation';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters' using errcode = 'check_violation';
  end if;

  update public.freight_rfqs set status = 'cancelled', cancelled_reason = v_reason where id = p_rfq;
  update public.freight_bids set status = 'rejected', decided_at = now() where rfq_id = p_rfq and status = 'submitted';
  if v_o.status = 'freight_requested' then
    update public.orders set status = 'ready_for_freight', version = version + 1 where id = v_o.id;
    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (v_o.id, 'freight_requested', 'ready_for_freight', v_uid, v_role, coalesce('Freight request cancelled: ' || v_reason, 'Freight request cancelled'));
  end if;
  if v_role = 'admin' then
    perform public.write_audit_log('freight.rfq_cancelled', 'freight_rfq', p_rfq::text, jsonb_build_object('rfq', v_r.rfq_number, 'reason', v_reason));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bidding
-- ---------------------------------------------------------------------------
create or replace function public.submit_freight_bid(
  p_rfq uuid,
  p_vehicle uuid,
  p_amount_minor bigint,
  p_eta_hours integer,
  p_delivery_date date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_r public.freight_rfqs%rowtype;
  v_c public.carrier_profiles%rowtype;
  v_v public.vehicles%rowtype;
  v_existing public.freight_bids%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if not public.has_role('carrier') then
    raise exception 'Only carriers can bid' using errcode = 'insufficient_privilege';
  end if;
  select * into v_c from public.carrier_profiles where id = v_uid;
  if not found or not public.is_verified_carrier(v_uid) then
    raise exception 'Only verified carriers can bid' using errcode = 'insufficient_privilege';
  end if;
  select * into v_r from public.freight_rfqs where id = p_rfq for update;
  if not found or not public.carrier_eligible_for_rfq(p_rfq, v_uid) then
    raise exception 'This load is closed or not available to you' using errcode = 'check_violation';
  end if;
  select * into v_v from public.vehicles where id = p_vehicle and carrier_id = v_uid;
  if not found or not public.vehicle_fits_rfq(p_vehicle, p_rfq) then
    raise exception 'Choose one of your verified vehicles that can carry this load' using errcode = 'check_violation';
  end if;
  if p_amount_minor is null or p_amount_minor < 1 or p_amount_minor > 100000000000 then
    raise exception 'Enter your price' using errcode = 'check_violation';
  end if;
  if p_eta_hours is null or p_eta_hours not between 1 and 720 then
    raise exception 'Enter a travel time between 1 and 720 hours' using errcode = 'check_violation';
  end if;
  if p_delivery_date is null or p_delivery_date < v_r.pickup_date then
    raise exception 'Delivery date must be on or after the pickup date' using errcode = 'check_violation';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'Keep the note under 300 characters' using errcode = 'check_violation';
  end if;

  select * into v_existing from public.freight_bids where rfq_id = p_rfq and carrier_id = v_uid for update;
  if found then
    if v_existing.status not in ('submitted', 'withdrawn') then
      raise exception 'Your bid on this load is already %', v_existing.status using errcode = 'check_violation';
    end if;
    update public.freight_bids
       set vehicle_id = p_vehicle, amount_minor = p_amount_minor, eta_hours = p_eta_hours,
           proposed_delivery_date = p_delivery_date, note = v_note, status = 'submitted',
           carrier_name = v_c.full_name, vehicle_type = v_v.vehicle_type, vehicle_class = v_v.vehicle_class,
           payload_kg = v_v.payload_kg, submitted_at = now(), decided_at = null
     where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.freight_bids (rfq_id, carrier_id, vehicle_id, amount_minor, currency, eta_hours, proposed_delivery_date, note,
                                   carrier_name, vehicle_type, vehicle_class, payload_kg)
  values (p_rfq, v_uid, p_vehicle, p_amount_minor, v_r.currency, p_eta_hours, p_delivery_date, v_note,
          v_c.full_name, v_v.vehicle_type, v_v.vehicle_class, v_v.payload_kg)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.withdraw_freight_bid(p_bid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.freight_bids%rowtype;
begin
  select * into v_b from public.freight_bids where id = p_bid and carrier_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Bid not found' using errcode = 'no_data_found';
  end if;
  if v_b.status <> 'submitted' then
    raise exception 'Only a live bid can be withdrawn' using errcode = 'check_violation';
  end if;
  if (select status from public.freight_rfqs where id = v_b.rfq_id) <> 'open' then
    raise exception 'This load has closed' using errcode = 'check_violation';
  end if;
  update public.freight_bids set status = 'withdrawn', decided_at = now() where id = p_bid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proforma: carrier and delivery estimate now come from the active assignment.
-- ---------------------------------------------------------------------------
create or replace function public.issue_proforma(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o public.orders%rowtype;
  v_a public.carrier_assignments%rowtype;
  v_rev integer;
  v_id uuid;
  v_validity integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'commerce.proforma_validity_days'), 7);
begin
  select * into v_o from public.orders where id = p_order;
  select * into v_a from public.carrier_assignments where order_id = p_order and status = 'active' order by assigned_at desc limit 1;
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
      'carrier', case when v_a.id is null then null else jsonb_build_object(
                   'name', v_a.carrier_snapshot ->> 'name',
                   'vehicle', v_a.carrier_snapshot ->> 'vehicle_label',
                   'plate', v_a.carrier_snapshot ->> 'plate_number',
                   'eta_hours', v_a.eta_hours) end,
      'estimated_delivery', v_a.proposed_delivery_date,
      'payment_status', 'unpaid',
      'placed_at', v_o.placed_at,
      'valid_until', now() + make_interval(days => v_validity),
      'terms', jsonb_build_array(
        'Prices are fixed for the quantities shown and valid until the date above.',
        case when v_a.id is null
             then 'Freight is quoted separately by verified carriers and added before payment.'
             else 'Freight is the verified carrier''s accepted sealed bid and is paid into escrow with the goods.' end,
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
-- Carrier selection — the buyer accepts one sealed bid.
-- ---------------------------------------------------------------------------
create or replace function public.select_freight_bid(p_bid uuid, p_expected_version integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_b public.freight_bids%rowtype;
  v_r public.freight_rfqs%rowtype;
  v_o public.orders%rowtype;
  v_c public.carrier_profiles%rowtype;
  v_v public.vehicles%rowtype;
  v_biz public.businesses%rowtype;
  v_assignment uuid;
begin
  select * into v_b from public.freight_bids where id = p_bid for update;
  if not found then
    raise exception 'Bid not found' using errcode = 'no_data_found';
  end if;
  select * into v_r from public.freight_rfqs where id = v_b.rfq_id for update;
  select * into v_o from public.orders where id = v_r.order_id for update;
  if v_o.buyer_id <> v_uid or not public.has_role('buyer') then
    raise exception 'Only the buyer chooses the carrier' using errcode = 'insufficient_privilege';
  end if;
  if p_expected_version is not null and p_expected_version <> v_o.version then
    raise exception 'This order was updated by someone else. Refresh and try again.' using errcode = 'serialization_failure';
  end if;
  if v_r.status <> 'open' or v_o.status <> 'freight_requested' then
    raise exception 'This freight request is no longer open' using errcode = 'check_violation';
  end if;
  if v_b.status <> 'submitted' then
    raise exception 'That bid is no longer available' using errcode = 'check_violation';
  end if;
  if not public.is_verified_carrier(v_b.carrier_id) or not public.vehicle_fits_rfq(v_b.vehicle_id, v_r.id) then
    raise exception 'That carrier or vehicle is no longer verified for this load' using errcode = 'check_violation';
  end if;
  select * into v_c from public.carrier_profiles where id = v_b.carrier_id;
  select * into v_v from public.vehicles where id = v_b.vehicle_id;
  select * into v_biz from public.businesses where id = v_o.seller_business_id;

  update public.freight_bids set status = 'accepted', decided_at = now() where id = p_bid;
  update public.freight_bids set status = 'rejected', decided_at = now() where rfq_id = v_r.id and id <> p_bid and status = 'submitted';
  update public.freight_rfqs set status = 'awarded', awarded_bid_id = p_bid where id = v_r.id;

  insert into public.carrier_assignments (rfq_id, order_id, bid_id, carrier_id, vehicle_id, amount_minor, currency, eta_hours,
                                          proposed_delivery_date, carrier_snapshot, pickup_snapshot, dropoff_snapshot, assigned_by)
  values (v_r.id, v_o.id, p_bid, v_b.carrier_id, v_b.vehicle_id, v_b.amount_minor, v_b.currency, v_b.eta_hours,
          v_b.proposed_delivery_date,
          jsonb_build_object('name', v_c.full_name, 'phone', v_c.phone, 'plate_number', v_v.plate_number,
                             'vehicle_type', v_v.vehicle_type, 'vehicle_class', v_v.vehicle_class, 'payload_kg', v_v.payload_kg,
                             'vehicle_label', initcap(replace(v_v.vehicle_type::text, '_', ' ')) || coalesce(' · ' || v_v.make_model, '')),
          jsonb_build_object('name', v_biz.trading_name, 'phone', v_biz.contact_phone, 'county', v_biz.county, 'town', v_biz.town,
                             'address_line', v_biz.address_line, 'pickup_date', v_r.pickup_date),
          v_o.delivery_address || jsonb_build_object('buyer_name', coalesce(v_o.buyer_snapshot ->> 'business_name', v_o.buyer_snapshot ->> 'name')),
          v_uid)
  returning id into v_assignment;

  update public.orders
     set freight_minor = v_b.amount_minor,
         total_minor = subtotal_minor + v_b.amount_minor,
         status = 'carrier_selected',
         version = version + 1
   where id = v_o.id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (v_o.id, 'freight_requested', 'carrier_selected', v_uid, 'buyer', 'Carrier selected: ' || v_c.full_name);

  perform public.issue_proforma(v_o.id);
  return v_assignment;
end;
$$;

-- ---------------------------------------------------------------------------
-- transition_order — Phase 3 moves + cancelling during freight.
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
    (v_o.status in ('fulfilling', 'ready_for_freight', 'freight_requested', 'carrier_selected') and p_to = 'cancelled' and v_actor in ('seller', 'admin'))
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

  v_reserved := v_o.status in ('confirmed', 'fulfilling', 'ready_for_freight', 'freight_requested', 'carrier_selected');

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
  elsif p_to = 'cancelled' then
    if v_reserved then
      for v_item in select product_id, quantity from public.order_items where order_id = p_order and product_id is not null loop
        update public.products set quantity_available = quantity_available + v_item.quantity where id = v_item.product_id;
      end loop;
    end if;
    -- Close any freight in flight. Bids and assignments are kept as history.
    update public.freight_bids b set status = 'rejected', decided_at = now()
      from public.freight_rfqs r
     where r.id = b.rfq_id and r.order_id = p_order and r.status = 'open' and b.status = 'submitted';
    update public.freight_rfqs set status = 'cancelled', cancelled_reason = coalesce(v_note, 'Order cancelled')
     where order_id = p_order and status = 'open';
    update public.carrier_assignments set status = 'cancelled', cancelled_at = now()
     where order_id = p_order and status = 'active';
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

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.carrier_profiles_guard() from public, anon, authenticated;
revoke execute on function public.vehicles_guard() from public, anon, authenticated;
revoke execute on function public.carrier_documents_guard() from public, anon, authenticated;
revoke execute on function public.is_verified_carrier(uuid) from public, anon;
revoke execute on function public.vehicle_fits_rfq(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.carrier_eligible_for_rfq(uuid, uuid) from public, anon, authenticated;

grant execute on function public.is_verified_carrier(uuid) to authenticated, service_role;
grant execute on function public.carrier_can_see_rfq(uuid) to authenticated, service_role;
grant execute on function public.is_rfq_buyer(uuid) to authenticated, service_role;
grant execute on function public.submit_carrier_for_review() to authenticated;
grant execute on function public.admin_review_carrier(uuid, public.carrier_verification_status, text) to authenticated;
grant execute on function public.admin_set_vehicle_verified(uuid, boolean) to authenticated;
grant execute on function public.create_freight_rfq(uuid, date, date, integer, text) to authenticated;
grant execute on function public.cancel_freight_rfq(uuid, text) to authenticated;
grant execute on function public.submit_freight_bid(uuid, uuid, bigint, integer, date, text) to authenticated;
grant execute on function public.withdraw_freight_bid(uuid) to authenticated;
grant execute on function public.select_freight_bid(uuid, integer) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges + RLS
-- ---------------------------------------------------------------------------
alter table public.carrier_profiles    enable row level security;
alter table public.vehicles            enable row level security;
alter table public.carrier_documents   enable row level security;
alter table public.freight_rfqs        enable row level security;
alter table public.freight_bids        enable row level security;
alter table public.carrier_assignments enable row level security;

revoke all on table public.carrier_profiles, public.vehicles, public.carrier_documents, public.freight_rfqs,
  public.freight_bids, public.carrier_assignments from anon, authenticated;
revoke all on sequence public.freight_rfq_number_seq from anon, authenticated;

grant select on table public.carrier_profiles to authenticated;
grant insert (id, full_name, phone, address, home_county, home_town, coverage_counties, is_available) on table public.carrier_profiles to authenticated;
grant update (full_name, phone, address, home_county, home_town, coverage_counties, is_available) on table public.carrier_profiles to authenticated;

grant select, delete on table public.vehicles to authenticated;
grant insert (carrier_id, vehicle_type, plate_number, make_model, year, payload_kg, cargo_volume_m3, is_active) on table public.vehicles to authenticated;
grant update (vehicle_type, plate_number, make_model, year, payload_kg, cargo_volume_m3, is_active) on table public.vehicles to authenticated;

grant select, delete on table public.carrier_documents to authenticated;
grant insert (carrier_id, vehicle_id, doc_type, storage_path, file_name, mime_type, size_bytes) on table public.carrier_documents to authenticated;

grant select on table public.freight_rfqs, public.freight_bids, public.carrier_assignments to authenticated;

grant all on table public.carrier_profiles, public.vehicles, public.freight_rfqs, public.freight_bids, public.carrier_assignments to service_role;
grant select, insert, delete on table public.carrier_documents to service_role;
grant usage on sequence public.freight_rfq_number_seq to service_role;

create policy carrier_profiles_select on public.carrier_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy carrier_profiles_insert on public.carrier_profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and (select public.has_role('carrier')));
create policy carrier_profiles_update on public.carrier_profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.has_role('carrier')))
  with check (id = (select auth.uid()));

create policy vehicles_select on public.vehicles
  for select to authenticated
  using (carrier_id = (select auth.uid()) or (select public.is_admin()));
create policy vehicles_insert on public.vehicles
  for insert to authenticated
  with check (carrier_id = (select auth.uid()) and (select public.has_role('carrier')));
create policy vehicles_update on public.vehicles
  for update to authenticated
  using (carrier_id = (select auth.uid()) and (select public.has_role('carrier')))
  with check (carrier_id = (select auth.uid()));
create policy vehicles_delete on public.vehicles
  for delete to authenticated
  using (carrier_id = (select auth.uid()) and not is_verified);

create policy carrier_documents_select on public.carrier_documents
  for select to authenticated
  using (carrier_id = (select auth.uid()) or (select public.is_admin()));
create policy carrier_documents_insert on public.carrier_documents
  for insert to authenticated
  with check (carrier_id = (select auth.uid()) and (select public.has_role('carrier')));
create policy carrier_documents_delete on public.carrier_documents
  for delete to authenticated
  using (carrier_id = (select auth.uid()));

create policy freight_rfqs_select on public.freight_rfqs
  for select to authenticated
  using ((select public.can_view_order(order_id)) or (select public.carrier_can_see_rfq(id)));

create policy freight_bids_select on public.freight_bids
  for select to authenticated
  using (carrier_id = (select auth.uid()) or (select public.is_rfq_buyer(rfq_id)) or (select public.is_admin()));

create policy carrier_assignments_select on public.carrier_assignments
  for select to authenticated
  using (carrier_id = (select auth.uid()) or (select public.can_view_order(order_id)));

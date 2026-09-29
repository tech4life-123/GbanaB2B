-- ============================================================================
-- GbanaB2B · Migration 0003 · Audit log & platform settings
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs — append-only record of sensitive actions.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_role   text,
  action       text not null check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  entity_type  text not null check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  entity_id    text,
  metadata     jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at   timestamptz not null default now()
);

comment on table public.audit_logs is 'Append-only. UPDATE/DELETE/TRUNCATE are blocked by trigger for every role, including service_role.';
comment on column public.audit_logs.action is 'Dotted verb, e.g. role.granted, platform_setting.updated, escrow.released.';

create index audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx   on public.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.prevent_mutation();
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.prevent_mutation();

-- Internal writer used by SECURITY DEFINER workflows. Not callable by clients.
create or replace function public.write_audit_log(
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role  text;
begin
  if v_actor is not null then
    select string_agg(ur.role::text, ',' order by ur.role)
      into v_role
      from public.user_roles ur
     where ur.user_id = v_actor and ur.status = 'active';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (v_actor, coalesce(v_role, case when v_actor is null then 'system' end),
          p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke execute on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit_log(text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- platform_settings — configurable business rules (fee, OTP windows, …).
-- Values are JSON so a setting can be a number, string or object; the type
-- of a setting can never change after creation, and numeric settings carry
-- bounds that the update function enforces.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key           text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  value         jsonb not null,
  description   text not null,
  is_sensitive  boolean not null default false,
  min_value     numeric,
  max_value     numeric,
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  constraint platform_settings_bounds_valid check (min_value is null or max_value is null or min_value <= max_value)
);

comment on table public.platform_settings is 'Business-rule configuration. Changed only via update_platform_setting(), which is admin-only and audited.';

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, value, description, is_sensitive, min_value, max_value) values
  ('commerce.platform_fee_bps',          '250',   'Platform commission on product subtotal, in basis points (250 = 2.5%). Freight is not commissioned.', false, 0, 2000),
  ('commerce.order_cancellation_window_minutes', '60', 'Minutes after order placement during which a buyer may cancel without seller approval.', false, 0, 10080),
  ('freight.bid_expiry_hours',           '48',    'Hours a freight RFQ stays open for bids before expiring.', false, 1, 720),
  ('delivery.otp_expiry_minutes',        '30',    'Lifetime of a delivery confirmation code.', false, 5, 1440),
  ('delivery.otp_max_attempts',          '5',     'Failed delivery-code entries allowed before the code locks.', false, 1, 10),
  ('auth.max_login_attempts',            '5',     'Failed sign-in OTP attempts before a temporary lock.', false, 1, 20),
  ('fx.display_currency',                '"USD"', 'Default currency for displaying prices when the user has no preference.', false, null, null);

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------
alter table public.audit_logs        enable row level security;
alter table public.platform_settings enable row level security;

revoke all on table public.audit_logs, public.platform_settings from anon, authenticated;
grant select on table public.audit_logs to authenticated;          -- filtered to admins by RLS
grant select on table public.platform_settings to authenticated;   -- non-sensitive rows only, by RLS
-- Supabase grants service_role ALL on new tables by default; strip mutation rights.
revoke update, delete, truncate on table public.audit_logs from service_role;
grant select, insert on table public.audit_logs to service_role;
grant all on table public.platform_settings to service_role;

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select public.is_admin()));

create policy platform_settings_select_public on public.platform_settings
  for select to authenticated
  using (not is_sensitive);

create policy platform_settings_select_admin on public.platform_settings
  for select to authenticated
  using ((select public.is_admin()));

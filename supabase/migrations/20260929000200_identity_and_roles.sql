-- ============================================================================
-- GbanaB2B · Migration 0002 · Identity & roles
-- profiles (1:1 with auth.users) and user_roles (many roles per user).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — personal account data, separate from auth credentials.
-- Business entities (businesses, business_members) arrive in Phase 2.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  phone              text unique
                       check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  full_name          text check (full_name is null or char_length(btrim(full_name)) between 2 and 120),
  display_name       text check (display_name is null or char_length(btrim(display_name)) between 1 and 60),
  preferred_currency public.currency_code not null default 'USD',
  locale             text not null default 'en-LR' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  default_role       public.app_role,
  status             public.account_status not null default 'active',
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Personal profile for each auth user. Created by trigger; users may edit only name/locale/currency columns.';
comment on column public.profiles.phone is 'E.164, mirrored from auth.users.phone by trigger. Not user-editable here.';
comment on column public.profiles.status is 'Admin-controlled. Suspended users fail has_role() checks everywhere.';

create index profiles_status_idx on public.profiles (status) where status <> 'active';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles — explicit role grants. Never written directly by clients.
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  status      public.role_status not null default 'active',
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  constraint user_roles_user_role_key unique (user_id, role),
  constraint user_roles_revocation_consistent
    check ((status = 'revoked') = (revoked_at is not null))
);

comment on table public.user_roles is 'Role grants. Mutated only through request_role / grant_role / revoke_role (SECURITY DEFINER, audited).';

create index user_roles_role_active_idx on public.user_roles (role) where status = 'active';

-- ---------------------------------------------------------------------------
-- Role helpers for RLS. SECURITY DEFINER so policies on user_roles itself do
-- not recurse; STABLE so Postgres can cache within a statement.
-- A suspended/closed account holds no effective roles.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and ur.status = 'active'
      and p.status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

grant execute on function public.has_role(public.app_role) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Keep profiles in step with auth.users.
-- Supabase stores phone without the leading '+'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (
    new.id,
    case when coalesce(new.phone, '') = '' then null else '+' || ltrim(new.phone, '+') end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_auth_user_phone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set phone = case when coalesce(new.phone, '') = '' then null else '+' || ltrim(new.phone, '+') end
   where id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_phone_change() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row
  when (old.phone is distinct from new.phone)
  execute function public.handle_auth_user_phone_change();

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;

revoke all on table public.profiles, public.user_roles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Column-level: users can only ever change these fields on their own row.
grant update (full_name, display_name, preferred_currency, locale) on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;
grant all on table public.profiles, public.user_roles to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and status = 'active')
  with check (id = (select auth.uid()));

create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_roles_select_admin on public.user_roles
  for select to authenticated
  using ((select public.is_admin()));

-- No INSERT/UPDATE/DELETE policies: role changes go through audited functions.

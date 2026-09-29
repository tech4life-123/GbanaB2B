-- ============================================================================
-- GbanaB2B · Migration 0001 · Foundation
-- Shared enums, helper functions and default-privilege hardening.
-- See docs/database/README.md for conventions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Defence in depth: new tables/functions in `public` grant NOTHING to the
-- client roles by default. Every table and function must grant explicitly.
-- RLS remains the primary control; this stops "forgot to enable RLS" and
-- "forgot to revoke execute" mistakes from becoming exposures.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- PUBLIC's EXECUTE-on-functions default is global and can only be removed
-- with the global form (a per-schema REVOKE cannot undo a global default).
alter default privileges revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('buyer', 'seller', 'carrier', 'admin');
comment on type public.app_role is
  'Platform roles. buyer/seller/carrier are self-assignable; admin is granted only by an admin. Holding carrier does NOT imply verification.';

create type public.account_status as enum ('active', 'suspended', 'closed');
create type public.role_status as enum ('active', 'revoked');
create type public.currency_code as enum ('USD', 'LRD');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Append-only guard, reused by audit logs now and financial ledgers later.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Table %.% is append-only: % is not permitted', tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

-- ============================================================================
-- GbanaB2B · Migration 0005 · Supabase advisor follow-ups
-- - Cover remaining foreign keys with indexes.
-- - One permissive SELECT policy per table (own-row OR admin) instead of two,
--   so Postgres evaluates a single policy per row.
-- - Close client access to Supabase's auto-created rls_auto_enable() event
--   trigger function (the database invokes it directly; it never needs RPC).
-- Behaviour is unchanged; supabase/tests re-verify every rule.
-- ============================================================================

create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
create index if not exists platform_settings_updated_by_idx on public.platform_settings (updated_by);

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists user_roles_select_own on public.user_roles;
drop policy if exists user_roles_select_admin on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists platform_settings_select_public on public.platform_settings;
drop policy if exists platform_settings_select_admin on public.platform_settings;
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using (not is_sensitive or (select public.is_admin()));

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable' and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

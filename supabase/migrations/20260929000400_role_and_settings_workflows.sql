-- ============================================================================
-- GbanaB2B · Migration 0004 · Role & settings workflows
-- The ONLY paths by which roles and platform settings change. Each validates
-- the caller, enforces the rule, and writes an audit record atomically.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- request_role — a user adds buyer / seller / carrier to their own account.
-- A role that an admin revoked cannot be self-reinstated.
-- ---------------------------------------------------------------------------
create or replace function public.request_role(p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing public.role_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('buyer', 'seller', 'carrier') then
    raise exception 'Role % cannot be self-assigned', p_role using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'Account is not active' using errcode = 'insufficient_privilege';
  end if;

  select status into v_existing from public.user_roles where user_id = v_uid and role = p_role;
  if v_existing = 'active' then
    return; -- idempotent
  elsif v_existing = 'revoked' then
    raise exception 'This role was removed by an administrator. Contact support.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.user_roles (user_id, role, granted_by) values (v_uid, p_role, v_uid);
  perform public.write_audit_log('role.self_assigned', 'user_role', v_uid::text,
                                 jsonb_build_object('role', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- set_default_role — which workspace to open after sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.set_default_role(p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.has_role(p_role) then
    raise exception 'You do not hold role %', p_role using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set default_role = p_role where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_onboarding — name + first role in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.complete_onboarding(p_full_name text, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Full name must be between 2 and 120 characters' using errcode = 'check_violation';
  end if;

  perform public.request_role(p_role);

  update public.profiles
     set full_name    = v_name,
         default_role = coalesce(default_role, p_role),
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- grant_role / revoke_role — admin only.
-- ---------------------------------------------------------------------------
create or replace function public.grant_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Only administrators can grant roles' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found' using errcode = 'no_data_found';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, p_role, v_uid)
  on conflict (user_id, role) do update
    set status = 'active', revoked_at = null, granted_by = excluded.granted_by, granted_at = now();

  perform public.write_audit_log('role.granted', 'user_role', p_user_id::text,
                                 jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.revoke_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'Only administrators can revoke roles' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = v_uid and p_role = 'admin' then
    raise exception 'Administrators cannot revoke their own admin role' using errcode = 'insufficient_privilege';
  end if;

  update public.user_roles
     set status = 'revoked', revoked_at = now()
   where user_id = p_user_id and role = p_role and status = 'active';

  if found then
    perform public.write_audit_log('role.revoked', 'user_role', p_user_id::text,
                                   jsonb_build_object('role', p_role));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_platform_setting — admin only; type-preserving; bounds-checked.
-- ---------------------------------------------------------------------------
create or replace function public.update_platform_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.platform_settings%rowtype;
  v_num numeric;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change platform settings' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.platform_settings where key = p_key for update;
  if not found then
    raise exception 'Unknown setting %', p_key using errcode = 'no_data_found';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> jsonb_typeof(v_row.value) then
    raise exception 'Setting % must remain of type %', p_key, jsonb_typeof(v_row.value)
      using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_value) = 'number' then
    v_num := (p_value #>> '{}')::numeric;
    if (v_row.min_value is not null and v_num < v_row.min_value)
       or (v_row.max_value is not null and v_num > v_row.max_value) then
      raise exception 'Setting % must be between % and %', p_key, v_row.min_value, v_row.max_value
        using errcode = 'check_violation';
    end if;
  end if;
  if v_row.value = p_value then
    return;
  end if;

  update public.platform_settings
     set value = p_value, updated_by = (select auth.uid())
   where key = p_key;

  perform public.write_audit_log('platform_setting.updated', 'platform_setting', p_key,
    jsonb_build_object('old', v_row.value, 'new', p_value));
end;
$$;

-- ---------------------------------------------------------------------------
-- bootstrap_admin — make the very first administrator. Callable only from the
-- SQL editor / service role; see docs/security/README.md.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_admin(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user from public.profiles where phone = p_phone;
  if v_user is null then
    raise exception 'No profile with phone % — the person must sign in once first', p_phone
      using errcode = 'no_data_found';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (v_user, 'admin', null)
  on conflict (user_id, role) do update set status = 'active', revoked_at = null, granted_at = now();

  perform public.write_audit_log('role.bootstrap_admin', 'user_role', v_user::text,
                                 jsonb_build_object('role', 'admin'));
  return v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute privileges (default privileges already revoked from clients).
-- ---------------------------------------------------------------------------
revoke execute on function public.bootstrap_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_admin(text) to service_role;

grant execute on function public.request_role(public.app_role)                to authenticated;
grant execute on function public.set_default_role(public.app_role)            to authenticated;
grant execute on function public.complete_onboarding(text, public.app_role)   to authenticated;
grant execute on function public.grant_role(uuid, public.app_role)            to authenticated;
grant execute on function public.revoke_role(uuid, public.app_role)           to authenticated;
grant execute on function public.update_platform_setting(text, jsonb)         to authenticated;

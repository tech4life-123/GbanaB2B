-- ============================================================================
-- Phase 8 RLS/privilege audit fixes.
--
-- Finding: SELECT was granted on whole rows of `businesses` and `products` to
-- `anon` and `authenticated`. Row-level security limited WHICH businesses were
-- visible, but every visible row exposed every column: the admin's internal
-- verification note, the owner's user id, registration number, street
-- address and phone numbers, to anyone on the internet.
--
-- Fix: column-level grants.
--   anon          -> only what public marketplace pages render.
--   authenticated -> everything except the admin's internal note, which is
--                    served by two narrow functions (own business / admin).
-- ============================================================================

-- ---------- businesses -----------------------------------------------------------------------------
revoke select on table public.businesses from anon, authenticated;

grant select (id, slug, trading_name, business_type, description, county, town, logo_path,
              status, verification_status, verified_at, created_at, updated_at)
  on table public.businesses to anon;

grant select (id, slug, trading_name, legal_name, business_type, description, county, town, address_line,
              contact_phone, whatsapp_phone, registration_number, logo_path, status,
              verification_status, verified_at, created_by, created_at, updated_at)
  on table public.businesses to authenticated;

-- ---------- products -------------------------------------------------------------------------------
revoke select on table public.products from anon;
grant select (id, business_id, category_id, slug, title, description, sku, unit_label, packaging_type, moq,
              quantity_available, currency, origin_country, unit_weight_g, unit_volume_cm3,
              length_mm, width_mm, height_mm, is_fragile, is_stackable, max_stack_layers, handling_notes,
              status, published_at, search_vector, created_at, updated_at)
  on table public.products to anon;

-- ---------- the internal note, through narrow doors ----------------------------------------------------
create or replace function public.business_verification_note(p_business uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select b.verification_note
    from public.businesses b
   where b.id = p_business
     and (public.is_business_member(b.id) or public.is_admin());
$$;

create or replace function public.admin_business_notes()
returns table (business_id uuid, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.verification_note
    from public.businesses b
   where public.is_admin() and b.verification_note is not null;
$$;

revoke execute on function public.business_verification_note(uuid), public.admin_business_notes() from public, anon;
grant execute on function public.business_verification_note(uuid), public.admin_business_notes() to authenticated;

-- ============================================================================
-- GbanaB2B · Migration 0007 · Product image storage
-- Public-read bucket for listing photos. Objects live at
--   {business_id}/{product_id}/{file}
-- and only owners/managers of that business may write there.
-- Private buckets (verification documents, dispute evidence) come later and
-- will NOT be public.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the first path segment is a business the caller can edit.
create or replace function public.can_write_business_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_first text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v_first !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_edit_business(v_first::uuid);
end;
$$;

revoke execute on function public.can_write_business_object(text) from public, anon;
grant execute on function public.can_write_business_object(text) to authenticated, service_role;

create policy product_images_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.can_write_business_object(name));

create policy product_images_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and public.can_write_business_object(name));

create policy product_images_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.can_write_business_object(name))
  with check (bucket_id = 'product-images' and public.can_write_business_object(name));

create policy product_images_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.can_write_business_object(name));

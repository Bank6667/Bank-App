insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-profile-assets', 'customer-profile-assets', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "admins upload customer profile images" on storage.objects;
create policy "admins upload customer profile images"
on storage.objects for insert to authenticated
with check (bucket_id = 'customer-profile-assets' and private.is_admin());

drop policy if exists "admins update customer profile images" on storage.objects;
create policy "admins update customer profile images"
on storage.objects for update to authenticated
using (bucket_id = 'customer-profile-assets' and private.is_admin())
with check (bucket_id = 'customer-profile-assets' and private.is_admin());

drop policy if exists "admins delete customer profile images" on storage.objects;
create policy "admins delete customer profile images"
on storage.objects for delete to authenticated
using (bucket_id = 'customer-profile-assets' and private.is_admin());

drop policy if exists "customers and admins read customer profile images" on storage.objects;
create policy "customers and admins read customer profile images"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-profile-assets'
  and (
    private.is_admin()
    or (storage.foldername(name))[2] = (select auth.uid())::text
  )
);

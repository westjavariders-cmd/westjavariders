CREATE POLICY "Staff and admin can read product media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-media' AND public.is_staff_or_admin());

CREATE POLICY "Admins upload product media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-media' AND public.is_admin());

CREATE POLICY "Admins update product media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-media' AND public.is_admin())
WITH CHECK (bucket_id = 'product-media' AND public.is_admin());

CREATE POLICY "Admins delete product media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-media' AND public.is_admin());
-- Package hero image: one optional storage path per product.
-- The private bucket `product-media` is created outside git (same as
-- website-media / motorbike-photos). Policies below match those buckets.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_path text;

-- duplicate_product inserts an explicit column list without image_path,
-- so a duplicated product starts with image_path NULL (no shared file).

CREATE POLICY "Staff and admin can read product media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-media' AND public.is_staff_or_admin());

CREATE POLICY "Admin can upload product media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-media' AND public.is_admin());

CREATE POLICY "Admin can update product media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-media' AND public.is_admin());

CREATE POLICY "Admin can delete product media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-media' AND public.is_admin());

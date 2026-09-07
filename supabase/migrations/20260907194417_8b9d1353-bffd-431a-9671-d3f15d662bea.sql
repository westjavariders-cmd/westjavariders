CREATE POLICY "Staff and admin can read accommodation photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'accommodation-photos' AND public.is_staff_or_admin());

CREATE POLICY "Admin can upload accommodation photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'accommodation-photos' AND public.is_admin());

CREATE POLICY "Admin can update accommodation photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'accommodation-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'accommodation-photos' AND public.is_admin());

CREATE POLICY "Admin can delete accommodation photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'accommodation-photos' AND public.is_admin());
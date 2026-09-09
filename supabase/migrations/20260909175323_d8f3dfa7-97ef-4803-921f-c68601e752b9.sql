CREATE POLICY "Staff read website media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'website-media' AND public.is_staff_or_admin());

CREATE POLICY "Admins upload website media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'website-media' AND public.is_admin());

CREATE POLICY "Admins update website media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'website-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'website-media' AND public.is_admin());

CREATE POLICY "Admins delete website media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'website-media' AND public.is_admin());
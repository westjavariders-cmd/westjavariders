CREATE TABLE public.motorbikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name text NOT NULL,
  public_name text,
  internal_reference text,
  description text,
  photo_path text,
  supplier_cost_idr bigint NOT NULL DEFAULT 0,
  customer_price_idr bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,
  internal_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT motorbikes_internal_name_not_blank CHECK (btrim(internal_name) <> ''),
  CONSTRAINT motorbikes_supplier_non_negative CHECK (supplier_cost_idr >= 0),
  CONSTRAINT motorbikes_customer_non_negative CHECK (customer_price_idr >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorbikes TO authenticated;
GRANT ALL ON public.motorbikes TO service_role;
ALTER TABLE public.motorbikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admin can read motorbikes" ON public.motorbikes
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage motorbikes" ON public.motorbikes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER motorbikes_set_updated_at BEFORE UPDATE ON public.motorbikes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX motorbikes_sort_idx ON public.motorbikes (sort_order, internal_name);

CREATE OR REPLACE FUNCTION public.duplicate_motorbike(_source uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_src motorbikes;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an ADMIN may duplicate a motorbike';
  END IF;

  SELECT * INTO v_src FROM motorbikes WHERE id = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motorbike not found';
  END IF;

  INSERT INTO motorbikes (
    internal_name, public_name, internal_reference, description, photo_path,
    supplier_cost_idr, customer_price_idr, active, internal_notes, sort_order)
  VALUES (
    left('Copy of ' || v_src.internal_name, 200), v_src.public_name, NULL,
    v_src.description, v_src.photo_path, v_src.supplier_cost_idr, v_src.customer_price_idr,
    false, v_src.internal_notes, v_src.sort_order + 1)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicate_motorbike(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_motorbike(uuid) TO authenticated;

CREATE POLICY "Staff and admin can read motorbike photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'motorbike-photos' AND public.is_staff_or_admin());

CREATE POLICY "Admin can upload motorbike photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'motorbike-photos' AND public.is_admin());

CREATE POLICY "Admin can update motorbike photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'motorbike-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'motorbike-photos' AND public.is_admin());

CREATE POLICY "Admin can delete motorbike photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'motorbike-photos' AND public.is_admin());
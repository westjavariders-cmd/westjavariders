CREATE TYPE public.accommodation_type AS ENUM ('hotel', 'beach_camping');

CREATE TABLE public.accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_type public.accommodation_type NOT NULL DEFAULT 'hotel',
  internal_name text NOT NULL CHECK (btrim(internal_name) <> ''),
  public_name text,
  internal_reference text,
  description text,
  location text,
  supplier_contact text,
  active boolean NOT NULL DEFAULT false,
  internal_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accommodations TO authenticated;
GRANT ALL ON public.accommodations TO service_role;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read accommodations" ON public.accommodations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage accommodations" ON public.accommodations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER accommodations_set_updated_at BEFORE UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.accommodation_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
  internal_name text NOT NULL CHECK (btrim(internal_name) <> ''),
  public_name text,
  internal_reference text,
  description text,
  max_guests integer NOT NULL DEFAULT 2 CHECK (max_guests >= 0),
  supplier_cost_per_night_idr bigint NOT NULL DEFAULT 0 CHECK (supplier_cost_per_night_idr >= 0),
  customer_price_per_night_idr bigint NOT NULL DEFAULT 0 CHECK (customer_price_per_night_idr >= 0),
  active boolean NOT NULL DEFAULT false,
  internal_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX accommodation_rooms_accommodation_idx
  ON public.accommodation_rooms (accommodation_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accommodation_rooms TO authenticated;
GRANT ALL ON public.accommodation_rooms TO service_role;
ALTER TABLE public.accommodation_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read rooms" ON public.accommodation_rooms
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage rooms" ON public.accommodation_rooms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER accommodation_rooms_set_updated_at BEFORE UPDATE ON public.accommodation_rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.accommodation_room_characteristics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.accommodation_rooms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  value text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX accommodation_room_characteristics_room_idx
  ON public.accommodation_room_characteristics (room_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accommodation_room_characteristics TO authenticated;
GRANT ALL ON public.accommodation_room_characteristics TO service_role;
ALTER TABLE public.accommodation_room_characteristics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read characteristics" ON public.accommodation_room_characteristics
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage characteristics" ON public.accommodation_room_characteristics
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER accommodation_room_characteristics_set_updated_at
  BEFORE UPDATE ON public.accommodation_room_characteristics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.accommodation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id uuid REFERENCES public.accommodations(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.accommodation_rooms(id) ON DELETE CASCADE,
  storage_path text NOT NULL CHECK (btrim(storage_path) <> ''),
  alt_text text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accommodation_photos_one_owner CHECK (
    (accommodation_id IS NOT NULL AND room_id IS NULL)
    OR (accommodation_id IS NULL AND room_id IS NOT NULL)
  )
);

CREATE INDEX accommodation_photos_accommodation_idx
  ON public.accommodation_photos (accommodation_id, sort_order);
CREATE INDEX accommodation_photos_room_idx
  ON public.accommodation_photos (room_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accommodation_photos TO authenticated;
GRANT ALL ON public.accommodation_photos TO service_role;
ALTER TABLE public.accommodation_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read photos" ON public.accommodation_photos
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage photos" ON public.accommodation_photos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER accommodation_photos_set_updated_at BEFORE UPDATE ON public.accommodation_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.duplicate_accommodation_room(_source uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_id uuid;
  v_src accommodation_rooms;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an ADMIN may duplicate a room';
  END IF;

  SELECT * INTO v_src FROM accommodation_rooms WHERE id = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  INSERT INTO accommodation_rooms (
    accommodation_id, internal_name, public_name, internal_reference, description,
    max_guests, supplier_cost_per_night_idr, customer_price_per_night_idr,
    active, internal_notes, sort_order)
  VALUES (
    v_src.accommodation_id, left('Copy of ' || v_src.internal_name, 200), v_src.public_name,
    NULL, v_src.description, v_src.max_guests, v_src.supplier_cost_per_night_idr,
    v_src.customer_price_per_night_idr, false, v_src.internal_notes, v_src.sort_order + 1)
  RETURNING id INTO v_new_id;

  INSERT INTO accommodation_room_characteristics (room_id, name, value, sort_order)
  SELECT v_new_id, name, value, sort_order
  FROM accommodation_room_characteristics WHERE room_id = _source;

  INSERT INTO accommodation_photos (room_id, storage_path, alt_text, is_primary, sort_order)
  SELECT v_new_id, storage_path, alt_text, is_primary, sort_order
  FROM accommodation_photos WHERE room_id = _source;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.duplicate_accommodation_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_accommodation_room(uuid) TO authenticated;
CREATE TYPE public.transport_type AS ENUM ('predefined_route', 'other_location');

CREATE TABLE public.transports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_type public.transport_type NOT NULL,
  internal_name text NOT NULL,
  public_name text,
  internal_reference text,
  description text,
  origin text,
  destination text,
  min_travel_hours smallint,
  max_travel_hours smallint,
  active boolean NOT NULL DEFAULT false,
  internal_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transports_internal_name_not_blank CHECK (btrim(internal_name) <> ''),
  CONSTRAINT transports_min_hours_range CHECK (min_travel_hours IS NULL OR (min_travel_hours BETWEEN 1 AND 9)),
  CONSTRAINT transports_max_hours_range CHECK (max_travel_hours IS NULL OR (max_travel_hours BETWEEN 1 AND 9)),
  CONSTRAINT transports_hours_order CHECK (
    min_travel_hours IS NULL OR max_travel_hours IS NULL OR min_travel_hours <= max_travel_hours
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transports TO authenticated;
GRANT ALL ON public.transports TO service_role;
ALTER TABLE public.transports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read transports" ON public.transports
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage transports" ON public.transports
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER transports_set_updated_at BEFORE UPDATE ON public.transports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.transport_people_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_id uuid NOT NULL REFERENCES public.transports(id) ON DELETE CASCADE,
  people smallint NOT NULL,
  supplier_cost_idr bigint NOT NULL DEFAULT 0,
  customer_price_idr bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transport_people_prices_people_range CHECK (people BETWEEN 1 AND 4),
  CONSTRAINT transport_people_prices_supplier_non_negative CHECK (supplier_cost_idr >= 0),
  CONSTRAINT transport_people_prices_customer_non_negative CHECK (customer_price_idr >= 0),
  CONSTRAINT transport_people_prices_unique UNIQUE (transport_id, people)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_people_prices TO authenticated;
GRANT ALL ON public.transport_people_prices TO service_role;
ALTER TABLE public.transport_people_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read transport people prices" ON public.transport_people_prices
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage transport people prices" ON public.transport_people_prices
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER transport_people_prices_set_updated_at BEFORE UPDATE ON public.transport_people_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX transport_people_prices_transport_idx ON public.transport_people_prices (transport_id, people);

CREATE TABLE public.transport_time_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_id uuid NOT NULL REFERENCES public.transports(id) ON DELETE CASCADE,
  travel_hours smallint NOT NULL,
  supplier_cost_idr bigint NOT NULL DEFAULT 0,
  customer_price_idr bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transport_time_prices_hours_range CHECK (travel_hours BETWEEN 1 AND 9),
  CONSTRAINT transport_time_prices_supplier_non_negative CHECK (supplier_cost_idr >= 0),
  CONSTRAINT transport_time_prices_customer_non_negative CHECK (customer_price_idr >= 0),
  CONSTRAINT transport_time_prices_unique UNIQUE (transport_id, travel_hours)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_time_prices TO authenticated;
GRANT ALL ON public.transport_time_prices TO service_role;
ALTER TABLE public.transport_time_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read transport time prices" ON public.transport_time_prices
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admin can manage transport time prices" ON public.transport_time_prices
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER transport_time_prices_set_updated_at BEFORE UPDATE ON public.transport_time_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX transport_time_prices_transport_idx ON public.transport_time_prices (transport_id, travel_hours);

CREATE OR REPLACE FUNCTION public.duplicate_transport(_source uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_src transports;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an ADMIN may duplicate a transport';
  END IF;

  SELECT * INTO v_src FROM transports WHERE id = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transport not found';
  END IF;

  INSERT INTO transports (
    transport_type, internal_name, public_name, internal_reference, description,
    origin, destination, min_travel_hours, max_travel_hours, active, internal_notes, sort_order)
  VALUES (
    v_src.transport_type, left('Copy of ' || v_src.internal_name, 200), v_src.public_name,
    NULL, v_src.description, v_src.origin, v_src.destination, v_src.min_travel_hours,
    v_src.max_travel_hours, false, v_src.internal_notes, v_src.sort_order + 1)
  RETURNING id INTO v_new_id;

  INSERT INTO transport_people_prices (transport_id, people, supplier_cost_idr, customer_price_idr)
  SELECT v_new_id, people, supplier_cost_idr, customer_price_idr
  FROM transport_people_prices WHERE transport_id = _source;

  INSERT INTO transport_time_prices (transport_id, travel_hours, supplier_cost_idr, customer_price_idr)
  SELECT v_new_id, travel_hours, supplier_cost_idr, customer_price_idr
  FROM transport_time_prices WHERE transport_id = _source;

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicate_transport(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_transport(uuid) TO authenticated;
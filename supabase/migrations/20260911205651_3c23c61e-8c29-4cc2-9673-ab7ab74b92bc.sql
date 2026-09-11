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
    supplier_cost_idr, customer_price_idr, active, internal_notes, sort_order, catalogue_id)
  VALUES (
    left('Copy of ' || v_src.internal_name, 200), v_src.public_name, NULL,
    v_src.description, v_src.photo_path, v_src.supplier_cost_idr, v_src.customer_price_idr,
    false, v_src.internal_notes, v_src.sort_order + 1, v_src.catalogue_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

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
    origin, destination, min_travel_hours, max_travel_hours, active, internal_notes, sort_order, catalogue_id)
  VALUES (
    v_src.transport_type, left('Copy of ' || v_src.internal_name, 200), v_src.public_name,
    NULL, v_src.description, v_src.origin, v_src.destination, v_src.min_travel_hours,
    v_src.max_travel_hours, false, v_src.internal_notes, v_src.sort_order + 1, v_src.catalogue_id)
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
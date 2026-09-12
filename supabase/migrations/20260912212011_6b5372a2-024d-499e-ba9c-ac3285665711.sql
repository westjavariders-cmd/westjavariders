CREATE OR REPLACE FUNCTION public.duplicate_catalogue(_source uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_src catalogues;
  v_next int;
  v_acc RECORD;
  v_new_acc uuid;
  v_room RECORD;
  v_new_room uuid;
  v_tr RECORD;
  v_new_tr uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an ADMIN may duplicate a catalogue';
  END IF;

  SELECT * INTO v_src FROM catalogues WHERE id = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalogue not found';
  END IF;

  SELECT COALESCE(COUNT(*), 0) INTO v_next FROM catalogues;

  INSERT INTO catalogues (template, internal_name, public_name, description,
    people_label, hours_label, active, sort_order)
  VALUES (
    v_src.template,
    left(v_src.internal_name || ' (copy)', 200),
    CASE WHEN v_src.public_name IS NULL THEN NULL ELSE left(v_src.public_name || ' (copy)', 200) END,
    v_src.description, v_src.people_label, v_src.hours_label, false, v_next)
  RETURNING id INTO v_new_id;

  -- Accommodations, with their rooms, characteristics and photos
  FOR v_acc IN SELECT * FROM accommodations WHERE catalogue_id = _source ORDER BY sort_order LOOP
    INSERT INTO accommodations (accommodation_type, internal_name, public_name, internal_reference,
      description, location, supplier_contact, active, internal_notes, sort_order, catalogue_id)
    VALUES (v_acc.accommodation_type, v_acc.internal_name, v_acc.public_name, NULL,
      v_acc.description, v_acc.location, v_acc.supplier_contact, v_acc.active,
      v_acc.internal_notes, v_acc.sort_order, v_new_id)
    RETURNING id INTO v_new_acc;

    INSERT INTO accommodation_photos (accommodation_id, storage_path, alt_text, is_primary, sort_order)
    SELECT v_new_acc, storage_path, alt_text, is_primary, sort_order
    FROM accommodation_photos WHERE accommodation_id = v_acc.id;

    FOR v_room IN SELECT * FROM accommodation_rooms WHERE accommodation_id = v_acc.id ORDER BY sort_order LOOP
      INSERT INTO accommodation_rooms (accommodation_id, internal_name, public_name, internal_reference,
        description, max_guests, supplier_cost_per_night_idr, customer_price_per_night_idr,
        active, internal_notes, sort_order)
      VALUES (v_new_acc, v_room.internal_name, v_room.public_name, NULL, v_room.description,
        v_room.max_guests, v_room.supplier_cost_per_night_idr, v_room.customer_price_per_night_idr,
        v_room.active, v_room.internal_notes, v_room.sort_order)
      RETURNING id INTO v_new_room;

      INSERT INTO accommodation_room_characteristics (room_id, name, value, sort_order)
      SELECT v_new_room, name, value, sort_order
      FROM accommodation_room_characteristics WHERE room_id = v_room.id;

      INSERT INTO accommodation_photos (room_id, storage_path, alt_text, is_primary, sort_order)
      SELECT v_new_room, storage_path, alt_text, is_primary, sort_order
      FROM accommodation_photos WHERE room_id = v_room.id;
    END LOOP;
  END LOOP;

  -- Transports, with their people and time prices
  FOR v_tr IN SELECT * FROM transports WHERE catalogue_id = _source ORDER BY sort_order LOOP
    INSERT INTO transports (transport_type, internal_name, public_name, internal_reference,
      description, origin, destination, min_travel_hours, max_travel_hours, active,
      internal_notes, sort_order, catalogue_id, calc_mode)
    VALUES (v_tr.transport_type, v_tr.internal_name, v_tr.public_name, NULL, v_tr.description,
      v_tr.origin, v_tr.destination, v_tr.min_travel_hours, v_tr.max_travel_hours, v_tr.active,
      v_tr.internal_notes, v_tr.sort_order, v_new_id, v_tr.calc_mode)
    RETURNING id INTO v_new_tr;

    INSERT INTO transport_people_prices (transport_id, people, supplier_cost_idr, customer_price_idr)
    SELECT v_new_tr, people, supplier_cost_idr, customer_price_idr
    FROM transport_people_prices WHERE transport_id = v_tr.id;

    INSERT INTO transport_time_prices (transport_id, travel_hours, supplier_cost_idr, customer_price_idr)
    SELECT v_new_tr, travel_hours, supplier_cost_idr, customer_price_idr
    FROM transport_time_prices WHERE transport_id = v_tr.id;
  END LOOP;

  -- Simple items
  INSERT INTO motorbikes (internal_name, public_name, internal_reference, description, photo_path,
    supplier_cost_idr, customer_price_idr, active, internal_notes, sort_order, catalogue_id)
  SELECT internal_name, public_name, NULL, description, photo_path, supplier_cost_idr,
    customer_price_idr, active, internal_notes, sort_order, v_new_id
  FROM motorbikes WHERE catalogue_id = _source;

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicate_catalogue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_catalogue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_catalogue(uuid) TO service_role;
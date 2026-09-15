ALTER TABLE public.fields
  ADD COLUMN photo_display_size text NOT NULL DEFAULT 'large',
  ADD CONSTRAINT fields_photo_display_size_check
    CHECK (photo_display_size IN ('small', 'medium', 'large'));

CREATE OR REPLACE FUNCTION public.duplicate_product(_source uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_src products;
  v_old_flow config_flows;
  v_new_flow_id uuid;
  s RECORD;
  f RECORD;
  o RECORD;
  d RECORD;
  c RECORD;
  pr RECORD;
  v_src_pricing product_pricing;
  v_new_pricing_id uuid;
  v_new_step_id uuid;
  v_new_field_id uuid;
  v_new_option_id uuid;
  v_new_component_id uuid;
  step_map jsonb := '{}'::jsonb;
  field_map jsonb := '{}'::jsonb;
  option_map jsonb := '{}'::jsonb;
  component_map jsonb := '{}'::jsonb;
  v_target_field uuid;
  v_target_option uuid;
  v_source_field uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an ADMIN may duplicate a product';
  END IF;

  SELECT * INTO v_src FROM products WHERE id = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  INSERT INTO products (kind, internal_name, internal_ref, status, sort_order)
  VALUES (v_src.kind, left('Copy of ' || v_src.internal_name, 200), NULL, 'draft', v_src.sort_order)
  RETURNING id INTO v_new_id;

  INSERT INTO product_translations (product_id, language_code, title, summary, body, seo_title, seo_description)
  SELECT v_new_id, language_code, title, summary, body, seo_title, seo_description
  FROM product_translations WHERE product_id = _source;

  INSERT INTO product_categories (product_id, category_id)
  SELECT v_new_id, category_id FROM product_categories WHERE product_id = _source;

  INSERT INTO product_placements (product_id, placement_id, display_order)
  SELECT v_new_id, placement_id, display_order FROM product_placements WHERE product_id = _source;

  FOR c IN SELECT * FROM product_components WHERE product_id = _source ORDER BY display_order LOOP
    INSERT INTO product_components (
      product_id, source_template_id, internal_name, customer_name, customer_description,
      unit_basis, internal_cost, customer_price, min_quantity, max_quantity, default_quantity,
      season_eligible, promo_eligible, display_order, is_active)
    VALUES (v_new_id, c.source_template_id, c.internal_name, c.customer_name, c.customer_description,
      c.unit_basis, c.internal_cost, c.customer_price, c.min_quantity, c.max_quantity, c.default_quantity,
      c.season_eligible, c.promo_eligible, c.display_order, c.is_active)
    RETURNING id INTO v_new_component_id;
    component_map := component_map || jsonb_build_object(c.id::text, v_new_component_id::text);
  END LOOP;

  SELECT * INTO v_old_flow FROM config_flows WHERE product_id = _source LIMIT 1;

  INSERT INTO config_flows (product_id, internal_name, is_active)
  VALUES (v_new_id,
          CASE WHEN v_old_flow.id IS NULL THEN NULL ELSE v_old_flow.internal_name END,
          COALESCE(v_old_flow.is_active, true))
  RETURNING id INTO v_new_flow_id;

  IF v_old_flow.id IS NOT NULL THEN
    FOR s IN SELECT * FROM steps WHERE flow_id = v_old_flow.id ORDER BY display_order LOOP
      INSERT INTO steps (flow_id, internal_name, customer_title, customer_description, display_order, is_active)
      VALUES (v_new_flow_id, s.internal_name, s.customer_title, s.customer_description, s.display_order, s.is_active)
      RETURNING id INTO v_new_step_id;
      step_map := step_map || jsonb_build_object(s.id::text, v_new_step_id::text);
    END LOOP;
  END IF;

  FOR f IN SELECT * FROM fields WHERE product_id = _source ORDER BY display_order LOOP
    IF step_map ? f.step_id::text THEN
      INSERT INTO fields (product_id, step_id, internal_name, variable_name, customer_label, help_text,
        field_type, is_required, is_active, default_value, min_value, max_value, display_order,
        option_source, catalogue_type, catalogue_id, photo_display_size)
      VALUES (v_new_id, (step_map ->> f.step_id::text)::uuid, f.internal_name, f.variable_name,
        f.customer_label, f.help_text, f.field_type, f.is_required, f.is_active, f.default_value,
        f.min_value, f.max_value, f.display_order, f.option_source, f.catalogue_type, f.catalogue_id,
        f.photo_display_size)
      RETURNING id INTO v_new_field_id;
      field_map := field_map || jsonb_build_object(f.id::text, v_new_field_id::text);

      FOR o IN SELECT * FROM field_options WHERE field_id = f.id ORDER BY display_order LOOP
        INSERT INTO field_options (field_id, internal_value, customer_label, description, display_order, is_active, is_default)
        VALUES (v_new_field_id, o.internal_value, o.customer_label, o.description, o.display_order, o.is_active, o.is_default)
        RETURNING id INTO v_new_option_id;
        option_map := option_map || jsonb_build_object(o.id::text, v_new_option_id::text);
      END LOOP;
    END IF;
  END LOOP;

  FOR d IN SELECT * FROM dependencies WHERE product_id = _source LOOP
    v_source_field := CASE WHEN field_map ? d.source_field_id::text THEN (field_map ->> d.source_field_id::text)::uuid END;
    v_target_field := CASE WHEN d.target_field_id IS NOT NULL AND field_map ? d.target_field_id::text
                           THEN (field_map ->> d.target_field_id::text)::uuid END;
    v_target_option := CASE WHEN d.target_option_id IS NOT NULL AND option_map ? d.target_option_id::text
                            THEN (option_map ->> d.target_option_id::text)::uuid END;
    IF v_source_field IS NOT NULL AND (v_target_field IS NOT NULL OR v_target_option IS NOT NULL) THEN
      INSERT INTO dependencies (product_id, source_field_id, source_option_id, operator, compare_value,
        action, action_value, target_field_id, target_option_id, is_active)
      VALUES (v_new_id, v_source_field,
        CASE WHEN d.source_option_id IS NOT NULL AND option_map ? d.source_option_id::text
             THEN (option_map ->> d.source_option_id::text)::uuid END,
        d.operator, d.compare_value, d.action, d.action_value, v_target_field, v_target_option, d.is_active);
    END IF;
  END LOOP;

  SELECT * INTO v_src_pricing FROM product_pricing WHERE product_id = _source;
  IF FOUND THEN
    INSERT INTO product_pricing (product_id, base_amount_idr, mode, status,
      people_variable, days_variable, nights_variable, sessions_variable, notes)
    VALUES (v_new_id, v_src_pricing.base_amount_idr, v_src_pricing.mode, 'draft',
      v_src_pricing.people_variable, v_src_pricing.days_variable, v_src_pricing.nights_variable,
      v_src_pricing.sessions_variable, v_src_pricing.notes)
    RETURNING id INTO v_new_pricing_id;

    UPDATE product_pricing pp SET
      people_variable = CASE WHEN EXISTS (
        SELECT 1 FROM fields fq WHERE fq.product_id = v_new_id AND fq.variable_name = pp.people_variable
          AND fq.field_type IN ('quantity','number')) THEN pp.people_variable END,
      days_variable = CASE WHEN EXISTS (
        SELECT 1 FROM fields fq WHERE fq.product_id = v_new_id AND fq.variable_name = pp.days_variable
          AND fq.field_type IN ('quantity','number')) THEN pp.days_variable END,
      nights_variable = CASE WHEN EXISTS (
        SELECT 1 FROM fields fq WHERE fq.product_id = v_new_id AND fq.variable_name = pp.nights_variable
          AND fq.field_type IN ('quantity','number')) THEN pp.nights_variable END,
      sessions_variable = CASE WHEN EXISTS (
        SELECT 1 FROM fields fq WHERE fq.product_id = v_new_id AND fq.variable_name = pp.sessions_variable
          AND fq.field_type IN ('quantity','number')) THEN pp.sessions_variable END
    WHERE pp.id = v_new_pricing_id;

    FOR pr IN
      SELECT * FROM pricing_rules
      WHERE pricing_id = v_src_pricing.id
        AND rule_type = 'component_quantity'
        AND component_id IS NOT NULL
      ORDER BY display_order
    LOOP
      IF component_map ? pr.component_id::text THEN
        INSERT INTO pricing_rules (pricing_id, rule_type, label, display_order, amount_idr,
          variable_name, component_id, quantity_variable, condition_variable, condition_operator,
          condition_value, sign, is_active)
        VALUES (v_new_pricing_id, pr.rule_type, pr.label, pr.display_order, pr.amount_idr,
          pr.variable_name, (component_map ->> pr.component_id::text)::uuid, pr.quantity_variable,
          pr.condition_variable, pr.condition_operator, pr.condition_value, pr.sign, pr.is_active);
      END IF;
    END LOOP;
  END IF;

  RETURN v_new_id;
END;
$function$;
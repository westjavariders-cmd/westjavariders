-- Three audience pages for the public menu.
-- Labels: Family Adventures, First Waves, Intermediate & Pro.
-- Trips are attached later in Admin (Product selection). Idempotent.

CREATE OR REPLACE FUNCTION public.ensure_audience_product_block(_page_id uuid, _internal text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  section_id uuid;
  lang text;
BEGIN
  SELECT s.id INTO section_id
  FROM public.website_sections s
  WHERE s.page_id = _page_id
  ORDER BY s.sort_order
  LIMIT 1;

  IF section_id IS NULL THEN
    INSERT INTO public.website_sections (page_id, internal_name, is_active, sort_order)
    VALUES (_page_id, _internal, true, 0)
    RETURNING id INTO section_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.website_blocks b
    WHERE b.section_id = section_id AND b.block_kind = 'product_selection'
  ) THEN
    INSERT INTO public.website_blocks (
      section_id, block_kind, internal_name, cta_kind, is_active, sort_order
    )
    VALUES (section_id, 'product_selection', _internal, 'none', true, 0);
  END IF;

  SELECT code INTO lang FROM public.languages WHERE is_master IS TRUE LIMIT 1;
  IF lang IS NULL THEN
    lang := 'en';
  END IF;

  INSERT INTO public.website_section_translations (section_id, language_code, title, subtitle)
  SELECT section_id, lang, NULL, NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM public.website_section_translations t
    WHERE t.section_id = section_id AND t.language_code = lang
  );
END;
$$;

DO $$
DECLARE
  lang text;
  family_id uuid;
  waves_id uuid;
  pro_id uuid;
  next_sort integer;
  nav_id uuid;
BEGIN
  SELECT code INTO lang FROM public.languages WHERE is_master IS TRUE LIMIT 1;
  IF lang IS NULL THEN
    lang := 'en';
  END IF;

  next_sort := COALESCE((SELECT max(sort_order) FROM public.website_pages), -1);

  INSERT INTO public.website_pages (slug, internal_name, is_active, sort_order)
  SELECT 'family-adventures', 'Family Adventures', true, next_sort + 1
  WHERE NOT EXISTS (SELECT 1 FROM public.website_pages WHERE slug = 'family-adventures');

  INSERT INTO public.website_pages (slug, internal_name, is_active, sort_order)
  SELECT 'first-waves', 'First Waves', true, next_sort + 2
  WHERE NOT EXISTS (SELECT 1 FROM public.website_pages WHERE slug = 'first-waves');

  INSERT INTO public.website_pages (slug, internal_name, is_active, sort_order)
  SELECT 'intermediate-and-pro', 'Intermediate & Pro', true, next_sort + 3
  WHERE NOT EXISTS (SELECT 1 FROM public.website_pages WHERE slug = 'intermediate-and-pro');

  SELECT id INTO family_id FROM public.website_pages WHERE slug = 'family-adventures';
  SELECT id INTO waves_id FROM public.website_pages WHERE slug = 'first-waves';
  SELECT id INTO pro_id FROM public.website_pages WHERE slug = 'intermediate-and-pro';

  INSERT INTO public.website_page_translations (page_id, language_code, title, subtitle)
  VALUES
    (family_id, lang, 'Family Adventures', NULL),
    (waves_id, lang, 'First Waves', NULL),
    (pro_id, lang, 'Intermediate & Pro', NULL)
  ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title;

  PERFORM public.ensure_audience_product_block(family_id, 'Family Adventures trips');
  PERFORM public.ensure_audience_product_block(waves_id, 'First Waves trips');
  PERFORM public.ensure_audience_product_block(pro_id, 'Intermediate & Pro trips');

  UPDATE public.website_nav_items n
  SET
    internal_name = 'First Waves',
    destination_kind = 'page',
    destination_page_id = waves_id,
    destination_product_id = NULL,
    destination_external_url = NULL
  WHERE n.destination_kind = 'build_your_trip'
     OR lower(n.internal_name) IN ('build your trip')
     OR EXISTS (
       SELECT 1 FROM public.website_nav_item_translations t
       WHERE t.nav_item_id = n.id AND lower(btrim(t.label)) = 'build your trip'
     );

  UPDATE public.website_nav_item_translations t
  SET label = 'First Waves'
  WHERE lower(btrim(t.label)) = 'build your trip';

  UPDATE public.website_nav_items n
  SET
    internal_name = 'Intermediate & Pro',
    destination_kind = 'page',
    destination_page_id = pro_id,
    destination_product_id = NULL,
    destination_external_url = NULL
  WHERE n.destination_page_id IN (
          SELECT p.id FROM public.website_pages p WHERE p.slug IN ('epic-trips', 'epic-trip')
        )
     OR lower(n.internal_name) IN ('epic trips', 'epic-trips', 'epic trip')
     OR EXISTS (
       SELECT 1 FROM public.website_nav_item_translations t
       WHERE t.nav_item_id = n.id AND lower(btrim(t.label)) IN ('epic trips', 'epic trip')
     );

  UPDATE public.website_nav_item_translations t
  SET label = 'Intermediate & Pro'
  WHERE lower(btrim(t.label)) IN ('epic trips', 'epic trip');

  IF NOT EXISTS (
    SELECT 1 FROM public.website_nav_items WHERE destination_page_id = family_id
  ) THEN
    INSERT INTO public.website_nav_items (
      internal_name, destination_kind, destination_page_id, is_active, sort_order
    )
    VALUES (
      'Family Adventures',
      'page',
      family_id,
      true,
      COALESCE((SELECT min(sort_order) FROM public.website_nav_items), 0)
    )
    RETURNING id INTO nav_id;

    INSERT INTO public.website_nav_item_translations (nav_item_id, language_code, label)
    VALUES (nav_id, lang, 'Family Adventures');
  END IF;
END $$;

DROP FUNCTION public.ensure_audience_product_block(uuid, text);

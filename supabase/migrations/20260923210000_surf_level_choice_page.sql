-- Intermediate surf-level page for Epic Trips and Build your trip.
-- Two doors; each product is chosen later in Admin (cta stays none until then).
-- Idempotent: skips structure if the page already exists.

DO $$
DECLARE
  lang text;
  page_id uuid;
  section_id uuid;
  door_beginner uuid;
  door_intermediate uuid;
  created boolean := false;
BEGIN
  SELECT code INTO lang FROM public.languages WHERE is_master IS TRUE LIMIT 1;
  IF lang IS NULL THEN
    lang := 'en';
  END IF;

  SELECT id INTO page_id FROM public.website_pages WHERE slug = 'choose-your-level';

  IF page_id IS NULL THEN
    created := true;
    INSERT INTO public.website_pages (slug, internal_name, is_active, sort_order)
    VALUES (
      'choose-your-level',
      'Surf level',
      true,
      COALESCE((SELECT max(sort_order) FROM public.website_pages), -1) + 1
    )
    RETURNING id INTO page_id;

    INSERT INTO public.website_page_translations (page_id, language_code, title, subtitle)
    VALUES (page_id, lang, 'What''s your surf level?', NULL);

    INSERT INTO public.website_sections (page_id, internal_name, is_active, sort_order)
    VALUES (page_id, 'Level choices', true, 0)
    RETURNING id INTO section_id;

    INSERT INTO public.website_blocks (
      section_id, block_kind, internal_name, cta_kind, is_active, sort_order
    )
    VALUES (section_id, 'door', 'Beginner and Low Intermediate', 'none', true, 0)
    RETURNING id INTO door_beginner;

    INSERT INTO public.website_blocks (
      section_id, block_kind, internal_name, cta_kind, is_active, sort_order
    )
    VALUES (section_id, 'door', 'Intermediate + Pro', 'none', true, 1)
    RETURNING id INTO door_intermediate;

    INSERT INTO public.website_block_translations (block_id, language_code, title, body, cta_label)
    VALUES
      (door_beginner, lang, 'Beginner and Low Intermediate', NULL, 'Choose'),
      (door_intermediate, lang, 'Intermediate + Pro', NULL, 'Choose');
  END IF;

  UPDATE public.website_nav_items n
  SET
    destination_kind = 'page',
    destination_page_id = page_id,
    destination_product_id = NULL,
    destination_external_url = NULL
  WHERE n.destination_page_id IS DISTINCT FROM page_id
    AND (
      n.destination_kind = 'build_your_trip'
      OR n.destination_page_id IN (
        SELECT p.id FROM public.website_pages p
        WHERE p.slug IN ('epic-trips', 'epic-trip', 'build-your-trip')
      )
      OR lower(n.internal_name) IN ('epic trips', 'build your trip', 'epic-trips')
      OR EXISTS (
        SELECT 1
        FROM public.website_nav_item_translations t
        WHERE t.nav_item_id = n.id
          AND lower(btrim(t.label)) IN ('epic trips', 'build your trip')
      )
    );
END $$;

-- Home mosaic only. Live audience pages are firstwaves / intermediatepro /
-- familyadventures (header nav already points there). Does not change
-- Explore, Meet the Boardriders or Book individually.

DO $$
DECLARE
  lang text;
  family_id uuid;
  waves_id uuid;
  pro_id uuid;
  home_id uuid;
  home_section uuid;
  door_id uuid;
  family_door uuid;
BEGIN
  SELECT code INTO lang FROM public.languages WHERE is_master IS TRUE LIMIT 1;
  IF lang IS NULL THEN lang := 'en'; END IF;

  SELECT id INTO waves_id FROM public.website_pages
  WHERE slug IN ('firstwaves', 'first-waves') AND is_active
  ORDER BY CASE slug WHEN 'firstwaves' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO pro_id FROM public.website_pages
  WHERE slug IN ('intermediatepro', 'intermediate-and-pro') AND is_active
  ORDER BY CASE slug WHEN 'intermediatepro' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT id INTO family_id FROM public.website_pages
  WHERE slug IN ('familyadventures', 'family-adventures') AND is_active
  ORDER BY CASE slug WHEN 'familyadventures' THEN 0 ELSE 1 END
  LIMIT 1;

  IF waves_id IS NULL OR pro_id IS NULL OR family_id IS NULL THEN
    RAISE NOTICE 'Audience pages missing; skip Home door retarget';
    RETURN;
  END IF;

  SELECT id INTO home_id FROM public.website_pages WHERE slug = 'home' LIMIT 1;
  IF home_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.id INTO home_section
  FROM public.website_sections s
  WHERE s.page_id = home_id AND s.is_active
  ORDER BY s.sort_order
  LIMIT 1;

  IF home_section IS NULL THEN
    RETURN;
  END IF;

  FOR door_id IN
    SELECT DISTINCT b.id
    FROM public.website_blocks b
    LEFT JOIN public.website_block_translations t ON t.block_id = b.id
    WHERE b.section_id = home_section
      AND b.block_kind = 'door'
      AND (
        b.cta_kind = 'build_your_trip'
        OR lower(btrim(coalesce(t.title, ''))) = 'build your trip'
      )
  LOOP
    UPDATE public.website_blocks
    SET internal_name = 'First Waves',
        cta_kind = 'page',
        cta_page_id = waves_id,
        cta_product_id = NULL,
        cta_external_url = NULL
    WHERE id = door_id;

    UPDATE public.website_block_translations
    SET title = 'First Waves',
        body = NULL,
        cta_label = NULL
    WHERE block_id = door_id
      AND (
        lower(btrim(title)) = 'build your trip'
        OR title IS NULL
      );
  END LOOP;

  FOR door_id IN
    SELECT DISTINCT b.id
    FROM public.website_blocks b
    LEFT JOIN public.website_block_translations t ON t.block_id = b.id
    WHERE b.section_id = home_section
      AND b.block_kind = 'door'
      AND lower(regexp_replace(btrim(coalesce(t.title, '')), '\s+', ' ', 'g')) IN ('epic trips', 'epic trip')
  LOOP
    UPDATE public.website_blocks
    SET internal_name = 'Intermediate & Pro',
        cta_kind = 'page',
        cta_page_id = pro_id,
        cta_product_id = NULL,
        cta_external_url = NULL
    WHERE id = door_id;

    UPDATE public.website_block_translations
    SET title = 'Intermediate & Pro'
    WHERE block_id = door_id
      AND lower(regexp_replace(btrim(title), '\s+', ' ', 'g')) IN ('epic trips', 'epic trip');
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM public.website_blocks b
    JOIN public.website_block_translations t ON t.block_id = b.id
    WHERE b.section_id = home_section
      AND b.block_kind = 'door'
      AND lower(btrim(t.title)) = 'family adventures'
  ) THEN
    INSERT INTO public.website_blocks (
      section_id, block_kind, internal_name, cta_kind, cta_page_id, is_active, sort_order
    )
    VALUES (
      home_section,
      'door',
      'Family Adventures',
      'page',
      family_id,
      true,
      COALESCE(
        (SELECT min(b.sort_order)
         FROM public.website_blocks b
         WHERE b.section_id = home_section AND b.block_kind = 'door'),
        0
      ) - 1
    )
    RETURNING id INTO family_door;

    INSERT INTO public.website_block_translations (block_id, language_code, title, body, cta_label)
    VALUES (family_door, lang, 'Family Adventures', NULL, NULL);
  END IF;
END $$;

-- Website configuration foundation ------------------------------------

CREATE TYPE public.website_block_kind AS ENUM (
  'hero', 'image_text', 'text', 'product_selection', 'video', 'people', 'door'
);

CREATE TYPE public.website_destination_kind AS ENUM (
  'none', 'page', 'product', 'build_your_trip', 'book_individually', 'external'
);

-- Pages ---------------------------------------------------------------
CREATE TABLE public.website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  internal_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_pages_slug_safe CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT website_pages_internal_name_len CHECK (char_length(internal_name) BETWEEN 1 AND 120)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_pages TO authenticated;
GRANT ALL ON public.website_pages TO service_role;
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website pages" ON public.website_pages
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website pages" ON public.website_pages
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.website_page_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  title text,
  subtitle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_page_translations TO authenticated;
GRANT ALL ON public.website_page_translations TO service_role;
ALTER TABLE public.website_page_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website page translations" ON public.website_page_translations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website page translations" ON public.website_page_translations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sections ------------------------------------------------------------
CREATE TABLE public.website_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  internal_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_sections_internal_name_len CHECK (char_length(internal_name) BETWEEN 1 AND 120)
);
CREATE INDEX website_sections_page_idx ON public.website_sections(page_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_sections TO authenticated;
GRANT ALL ON public.website_sections TO service_role;
ALTER TABLE public.website_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website sections" ON public.website_sections
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website sections" ON public.website_sections
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.website_section_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.website_sections(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  title text,
  subtitle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_section_translations TO authenticated;
GRANT ALL ON public.website_section_translations TO service_role;
ALTER TABLE public.website_section_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website section translations" ON public.website_section_translations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website section translations" ON public.website_section_translations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Blocks --------------------------------------------------------------
CREATE TABLE public.website_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.website_sections(id) ON DELETE CASCADE,
  block_kind public.website_block_kind NOT NULL,
  internal_name text NOT NULL,
  media_kind text,
  media_path text,
  cta_kind public.website_destination_kind NOT NULL DEFAULT 'none',
  cta_page_id uuid REFERENCES public.website_pages(id) ON DELETE SET NULL,
  cta_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  cta_external_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_blocks_internal_name_len CHECK (char_length(internal_name) BETWEEN 1 AND 120),
  CONSTRAINT website_blocks_media_kind_valid CHECK (media_kind IS NULL OR media_kind IN ('image', 'video')),
  CONSTRAINT website_blocks_media_pair CHECK ((media_kind IS NULL) = (media_path IS NULL)),
  CONSTRAINT website_blocks_external_url_safe CHECK (
    cta_external_url IS NULL OR cta_external_url ~ '^https://[^\s]+$'
  ),
  CONSTRAINT website_blocks_cta_target CHECK (
    (cta_kind <> 'page' OR cta_page_id IS NOT NULL)
    AND (cta_kind <> 'product' OR cta_product_id IS NOT NULL)
    AND (cta_kind <> 'external' OR cta_external_url IS NOT NULL)
  )
);
CREATE INDEX website_blocks_section_idx ON public.website_blocks(section_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_blocks TO authenticated;
GRANT ALL ON public.website_blocks TO service_role;
ALTER TABLE public.website_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website blocks" ON public.website_blocks
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website blocks" ON public.website_blocks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.website_block_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.website_blocks(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  title text,
  body text,
  cta_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_block_translations TO authenticated;
GRANT ALL ON public.website_block_translations TO service_role;
ALTER TABLE public.website_block_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website block translations" ON public.website_block_translations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website block translations" ON public.website_block_translations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.website_block_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.website_blocks(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, product_id)
);
CREATE INDEX website_block_products_block_idx ON public.website_block_products(block_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_block_products TO authenticated;
GRANT ALL ON public.website_block_products TO service_role;
ALTER TABLE public.website_block_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website block products" ON public.website_block_products
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website block products" ON public.website_block_products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Navigation ----------------------------------------------------------
CREATE TABLE public.website_nav_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name text NOT NULL,
  destination_kind public.website_destination_kind NOT NULL DEFAULT 'page',
  destination_page_id uuid REFERENCES public.website_pages(id) ON DELETE SET NULL,
  destination_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  destination_external_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_nav_items_internal_name_len CHECK (char_length(internal_name) BETWEEN 1 AND 120),
  CONSTRAINT website_nav_items_external_url_safe CHECK (
    destination_external_url IS NULL OR destination_external_url ~ '^https://[^\s]+$'
  ),
  CONSTRAINT website_nav_items_target CHECK (
    destination_kind <> 'none'
    AND (destination_kind <> 'page' OR destination_page_id IS NOT NULL)
    AND (destination_kind <> 'product' OR destination_product_id IS NOT NULL)
    AND (destination_kind <> 'external' OR destination_external_url IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_nav_items TO authenticated;
GRANT ALL ON public.website_nav_items TO service_role;
ALTER TABLE public.website_nav_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website nav items" ON public.website_nav_items
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website nav items" ON public.website_nav_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.website_nav_item_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nav_item_id uuid NOT NULL REFERENCES public.website_nav_items(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nav_item_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_nav_item_translations TO authenticated;
GRANT ALL ON public.website_nav_item_translations TO service_role;
ALTER TABLE public.website_nav_item_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website nav item translations" ON public.website_nav_item_translations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website nav item translations" ON public.website_nav_item_translations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- updated_at triggers (reuse the existing helper) ----------------------
CREATE TRIGGER website_pages_updated_at BEFORE UPDATE ON public.website_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_page_translations_updated_at BEFORE UPDATE ON public.website_page_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_sections_updated_at BEFORE UPDATE ON public.website_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_section_translations_updated_at BEFORE UPDATE ON public.website_section_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_blocks_updated_at BEFORE UPDATE ON public.website_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_block_translations_updated_at BEFORE UPDATE ON public.website_block_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_nav_items_updated_at BEFORE UPDATE ON public.website_nav_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER website_nav_item_translations_updated_at BEFORE UPDATE ON public.website_nav_item_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
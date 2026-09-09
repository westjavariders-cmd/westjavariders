CREATE TABLE public.website_landing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  video_path text,
  image_path text,
  image_alt text,
  cta_kind public.website_destination_kind NOT NULL DEFAULT 'page',
  cta_page_id uuid REFERENCES public.website_pages(id) ON DELETE SET NULL,
  cta_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  cta_external_url text,
  singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_landing_singleton UNIQUE (singleton),
  CONSTRAINT website_landing_singleton_true CHECK (singleton IS TRUE),
  CONSTRAINT website_landing_external_https CHECK (
    cta_external_url IS NULL OR cta_external_url ~ '^https://[^\s]+$'
  ),
  CONSTRAINT website_landing_image_alt_len CHECK (
    image_alt IS NULL OR char_length(image_alt) BETWEEN 1 AND 200
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_landing TO authenticated;
GRANT ALL ON public.website_landing TO service_role;
ALTER TABLE public.website_landing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website landing" ON public.website_landing
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website landing" ON public.website_landing
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER website_landing_updated_at BEFORE UPDATE ON public.website_landing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.website_landing_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_id uuid NOT NULL REFERENCES public.website_landing(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  title text,
  subtitle text,
  cta_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landing_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_landing_translations TO authenticated;
GRANT ALL ON public.website_landing_translations TO service_role;
ALTER TABLE public.website_landing_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read website landing translations" ON public.website_landing_translations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage website landing translations" ON public.website_landing_translations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER website_landing_translations_updated_at BEFORE UPDATE ON public.website_landing_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.website_landing (is_active, cta_kind, cta_page_id)
SELECT false, 'page', (SELECT id FROM public.website_pages WHERE slug = 'home');

INSERT INTO public.website_landing_translations (landing_id, language_code, title, subtitle, cta_label)
SELECT l.id, (SELECT code FROM public.languages WHERE is_master IS TRUE ORDER BY display_order LIMIT 1),
       'CIMAJA BOARDRIDERS', 'SURF. EXPLORE. EXPERIENCE WEST JAVA.', 'ENTER CIMAJA BOARDRIDERS'
FROM public.website_landing l;
ALTER TYPE public.website_block_kind ADD VALUE IF NOT EXISTS 'catalogue';

CREATE TABLE public.website_block_catalogues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.website_blocks(id) ON DELETE CASCADE,
  catalogue_id uuid NOT NULL REFERENCES public.catalogues(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, catalogue_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_block_catalogues TO authenticated;
GRANT ALL ON public.website_block_catalogues TO service_role;
ALTER TABLE public.website_block_catalogues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read block catalogues" ON public.website_block_catalogues FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can manage block catalogues" ON public.website_block_catalogues FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.website_block_catalogues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TYPE public.catalogue_template AS ENUM ('accommodation', 'transport', 'motorbike');

CREATE TABLE public.catalogues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template public.catalogue_template NOT NULL,
  internal_name text NOT NULL,
  public_name text,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT catalogues_internal_name_not_blank CHECK (btrim(internal_name) <> '')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogues TO authenticated;
GRANT ALL ON public.catalogues TO service_role;

ALTER TABLE public.catalogues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admin can read catalogues"
  ON public.catalogues FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admin can manage catalogues"
  ON public.catalogues FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER catalogues_set_updated_at
  BEFORE UPDATE ON public.catalogues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX catalogues_template_idx ON public.catalogues (template, sort_order);

ALTER TABLE public.accommodations
  ADD COLUMN catalogue_id uuid REFERENCES public.catalogues(id) ON DELETE RESTRICT;
ALTER TABLE public.transports
  ADD COLUMN catalogue_id uuid REFERENCES public.catalogues(id) ON DELETE RESTRICT;
ALTER TABLE public.motorbikes
  ADD COLUMN catalogue_id uuid REFERENCES public.catalogues(id) ON DELETE RESTRICT;

CREATE INDEX accommodations_catalogue_id_idx ON public.accommodations (catalogue_id);
CREATE INDEX transports_catalogue_id_idx ON public.transports (catalogue_id);
CREATE INDEX motorbikes_catalogue_id_idx ON public.motorbikes (catalogue_id);
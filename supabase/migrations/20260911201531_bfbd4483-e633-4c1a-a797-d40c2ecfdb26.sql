ALTER TABLE public.fields
  ADD COLUMN catalogue_id uuid REFERENCES public.catalogues(id) ON DELETE SET NULL;

CREATE INDEX fields_catalogue_id_idx ON public.fields (catalogue_id);
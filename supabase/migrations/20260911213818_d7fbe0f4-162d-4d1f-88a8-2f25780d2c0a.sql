ALTER TABLE public.accommodations ALTER COLUMN catalogue_id SET NOT NULL;
ALTER TABLE public.transports ALTER COLUMN catalogue_id SET NOT NULL;
ALTER TABLE public.motorbikes ALTER COLUMN catalogue_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS accommodations_catalogue_id_idx ON public.accommodations (catalogue_id);
CREATE INDEX IF NOT EXISTS transports_catalogue_id_idx ON public.transports (catalogue_id);
CREATE INDEX IF NOT EXISTS motorbikes_catalogue_id_idx ON public.motorbikes (catalogue_id);
CREATE INDEX IF NOT EXISTS fields_catalogue_id_idx ON public.fields (catalogue_id);
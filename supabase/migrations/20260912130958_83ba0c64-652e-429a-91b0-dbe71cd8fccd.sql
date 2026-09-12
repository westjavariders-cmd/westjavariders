ALTER TABLE public.catalogues
  ADD COLUMN IF NOT EXISTS people_label text,
  ADD COLUMN IF NOT EXISTS hours_label text;
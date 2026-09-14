ALTER TABLE public.packages
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN line_kind text NOT NULL DEFAULT 'product',
  ADD COLUMN catalogue_id uuid REFERENCES public.catalogues(id) ON DELETE SET NULL,
  ADD COLUMN catalogue_type public.catalogue_source_type,
  ADD COLUMN catalogue_item_id uuid,
  ADD COLUMN item_title text;

ALTER TABLE public.packages
  ADD CONSTRAINT packages_line_kind_check CHECK (line_kind IN ('product', 'catalogue_item')),
  ADD CONSTRAINT packages_line_shape_check CHECK (
    (line_kind = 'product' AND product_id IS NOT NULL)
    OR (line_kind = 'catalogue_item'
        AND product_id IS NULL
        AND catalogue_id IS NOT NULL
        AND catalogue_type IS NOT NULL
        AND catalogue_item_id IS NOT NULL)
  );

CREATE INDEX packages_catalogue_item_idx ON public.packages (catalogue_id, catalogue_item_id);
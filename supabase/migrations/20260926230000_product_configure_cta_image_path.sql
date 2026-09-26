-- Optional photo for the Configure this trip button on the intermediate page.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS configure_cta_image_path text;

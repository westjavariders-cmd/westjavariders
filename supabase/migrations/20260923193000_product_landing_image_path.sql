-- Optional photo for the product intermediate page (PackageLanding).
-- Independent of products.image_path (listing / configurator cover).
-- Existing rows stay NULL; the public page then falls back to image_path.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS landing_image_path text;

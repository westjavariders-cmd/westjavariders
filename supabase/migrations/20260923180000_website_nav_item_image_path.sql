-- Optional image for each public menu item. Independent of destination page media.
-- Existing rows stay NULL; the public menu is unchanged until Admin uploads.

ALTER TABLE public.website_nav_items
  ADD COLUMN IF NOT EXISTS image_path text;

-- Optional photo for Book individually section tiles (the first group button).
ALTER TABLE public.website_sections
  ADD COLUMN IF NOT EXISTS image_path text;

-- Optional photo per configurator step. Public falls back to the product cover
-- when this is empty. Does not change pricing or answers.
ALTER TABLE public.steps
  ADD COLUMN IF NOT EXISTS image_path text;

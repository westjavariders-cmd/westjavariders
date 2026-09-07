ALTER TABLE public.languages DROP CONSTRAINT languages_code_check;
ALTER TABLE public.languages ADD CONSTRAINT languages_code_check
  CHECK (code ~ '^[a-z]{2,3}(-[A-Z]{2})?$');

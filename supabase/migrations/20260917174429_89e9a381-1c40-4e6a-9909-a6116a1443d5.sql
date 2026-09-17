CREATE TABLE public.text_translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL,
  ref text NOT NULL,
  field text NOT NULL,
  language_code text NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT text_translations_unique UNIQUE (scope, ref, field, language_code)
);

CREATE INDEX text_translations_lookup_idx ON public.text_translations (scope, language_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_translations TO authenticated;
GRANT ALL ON public.text_translations TO service_role;

ALTER TABLE public.text_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read text translations" ON public.text_translations
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE POLICY "Admins manage text translations" ON public.text_translations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER text_translations_set_updated_at
  BEFORE UPDATE ON public.text_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Active commercial brand: West Java Riders.
-- Does not rewrite historical migrations. Only updates live values that still
-- carry the retired brand name, so custom CMS copy is left alone.

UPDATE public.settings
SET value = 'West Java Riders'
WHERE key = 'business_name'
  AND value = 'Cimaja Boardriders';

UPDATE public.website_landing_translations
SET title = 'WEST JAVA RIDERS'
WHERE title = 'CIMAJA BOARDRIDERS';

UPDATE public.website_landing_translations
SET cta_label = 'ENTER WEST JAVA RIDERS'
WHERE cta_label = 'ENTER CIMAJA BOARDRIDERS';

INSERT INTO public.settings (key, value, value_type, description) VALUES
  (
    'booking_conditions_body',
    'West Java Riders booking conditions will be published here.',
    'string',
    'Full booking conditions shown in the cart popup before payment. Plain text; up to 20000 characters.'
  )
ON CONFLICT (key) DO NOTHING;

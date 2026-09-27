INSERT INTO public.settings (key, value, value_type, description) VALUES
  (
    'gift_explanation_body',
    $gift$We send everything to you, so you can give it yourself.
The price is never shown on a gift.$gift$,
    'string',
    'Optional cart popup explaining how This is a gift works. Plain text; up to 20000 characters.'
  )
ON CONFLICT (key) DO NOTHING;

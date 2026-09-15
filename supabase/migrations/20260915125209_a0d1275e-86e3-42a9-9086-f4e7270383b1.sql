CREATE TABLE public.saved_trips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  lines jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '180 days')
);

GRANT ALL ON public.saved_trips TO service_role;

ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER saved_trips_set_updated_at
BEFORE UPDATE ON public.saved_trips
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
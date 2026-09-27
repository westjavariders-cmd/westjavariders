-- Transport catalogue: people 1–7, travel-time (customer “days”) 1–14.
ALTER TABLE public.transport_people_prices
  DROP CONSTRAINT IF EXISTS transport_people_prices_people_range;
ALTER TABLE public.transport_people_prices
  ADD CONSTRAINT transport_people_prices_people_range CHECK (people BETWEEN 1 AND 7);

ALTER TABLE public.transport_time_prices
  DROP CONSTRAINT IF EXISTS transport_time_prices_hours_range;
ALTER TABLE public.transport_time_prices
  ADD CONSTRAINT transport_time_prices_hours_range CHECK (travel_hours BETWEEN 1 AND 14);

ALTER TABLE public.transports
  DROP CONSTRAINT IF EXISTS transports_min_hours_range;
ALTER TABLE public.transports
  DROP CONSTRAINT IF EXISTS transports_max_hours_range;
ALTER TABLE public.transports
  ADD CONSTRAINT transports_min_hours_range CHECK (
    min_travel_hours IS NULL OR (min_travel_hours BETWEEN 1 AND 14)
  );
ALTER TABLE public.transports
  ADD CONSTRAINT transports_max_hours_range CHECK (
    max_travel_hours IS NULL OR (max_travel_hours BETWEEN 1 AND 14)
  );

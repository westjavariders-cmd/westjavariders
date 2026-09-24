-- Transport catalogue: people 1–10, travel-time (customer “days”) 1–30.
-- Identity price tables (1 costs 1, 2 costs 2, …) are extended the same way:
-- 8 people → 8, 15 hours → 15. Other Rupiah tables are left untouched.

ALTER TABLE public.transport_people_prices
  DROP CONSTRAINT IF EXISTS transport_people_prices_people_range;
ALTER TABLE public.transport_people_prices
  ADD CONSTRAINT transport_people_prices_people_range CHECK (people BETWEEN 1 AND 10);

ALTER TABLE public.transport_time_prices
  DROP CONSTRAINT IF EXISTS transport_time_prices_hours_range;
ALTER TABLE public.transport_time_prices
  ADD CONSTRAINT transport_time_prices_hours_range CHECK (travel_hours BETWEEN 1 AND 30);

ALTER TABLE public.transports
  DROP CONSTRAINT IF EXISTS transports_min_hours_range;
ALTER TABLE public.transports
  DROP CONSTRAINT IF EXISTS transports_max_hours_range;
ALTER TABLE public.transports
  ADD CONSTRAINT transports_min_hours_range CHECK (
    min_travel_hours IS NULL OR (min_travel_hours BETWEEN 1 AND 30)
  );
ALTER TABLE public.transports
  ADD CONSTRAINT transports_max_hours_range CHECK (
    max_travel_hours IS NULL OR (max_travel_hours BETWEEN 1 AND 30)
  );

UPDATE public.transports
SET max_travel_hours = 30
WHERE max_travel_hours IN (9, 14);

INSERT INTO public.transport_people_prices (transport_id, people, supplier_cost_idr, customer_price_idr)
SELECT t.id, n.n, 0, n.n
FROM public.transports t
CROSS JOIN generate_series(1, 10) AS n(n)
WHERE EXISTS (
  SELECT 1 FROM public.transport_people_prices p WHERE p.transport_id = t.id
)
AND (
  SELECT MIN(p.people) FROM public.transport_people_prices p WHERE p.transport_id = t.id
) = 1
AND (
  SELECT MAX(p.people) FROM public.transport_people_prices p WHERE p.transport_id = t.id
) = (
  SELECT COUNT(*)::int FROM public.transport_people_prices p WHERE p.transport_id = t.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.transport_people_prices p
  WHERE p.transport_id = t.id
    AND p.customer_price_idr IS DISTINCT FROM p.people
)
AND NOT EXISTS (
  SELECT 1
  FROM public.transport_people_prices p
  WHERE p.transport_id = t.id
    AND p.people = n.n
);

INSERT INTO public.transport_time_prices (transport_id, travel_hours, supplier_cost_idr, customer_price_idr)
SELECT t.id, n.n, 0, n.n
FROM public.transports t
CROSS JOIN generate_series(1, 30) AS n(n)
WHERE EXISTS (
  SELECT 1 FROM public.transport_time_prices p WHERE p.transport_id = t.id
)
AND (
  SELECT MIN(p.travel_hours) FROM public.transport_time_prices p WHERE p.transport_id = t.id
) = 1
AND (
  SELECT MAX(p.travel_hours) FROM public.transport_time_prices p WHERE p.transport_id = t.id
) = (
  SELECT COUNT(*)::int FROM public.transport_time_prices p WHERE p.transport_id = t.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.transport_time_prices p
  WHERE p.transport_id = t.id
    AND p.customer_price_idr IS DISTINCT FROM p.travel_hours
)
AND NOT EXISTS (
  SELECT 1
  FROM public.transport_time_prices p
  WHERE p.transport_id = t.id
    AND p.travel_hours = n.n
);

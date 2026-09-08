-- FX rates: IDR is always the base currency; one current rate per customer currency.
CREATE TABLE public.fx_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency_code text NOT NULL DEFAULT 'IDR' REFERENCES public.currencies(code),
  quote_currency_code text NOT NULL REFERENCES public.currencies(code),
  -- How many whole Rupiah one unit of the quote currency is worth. Exact numeric.
  rate numeric(20, 6) NOT NULL,
  effective_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fx_rates_base_is_idr CHECK (base_currency_code = 'IDR'),
  CONSTRAINT fx_rates_quote_not_base CHECK (quote_currency_code <> base_currency_code),
  CONSTRAINT fx_rates_rate_positive CHECK (rate > 0),
  CONSTRAINT fx_rates_source_not_blank CHECK (btrim(source) <> '')
);

CREATE UNIQUE INDEX fx_rates_one_current
  ON public.fx_rates (base_currency_code, quote_currency_code)
  WHERE is_current;
CREATE INDEX fx_rates_history ON public.fx_rates (quote_currency_code, effective_at DESC);

GRANT SELECT ON public.fx_rates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can read fx rates"
  ON public.fx_rates FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins can insert fx rates"
  ON public.fx_rates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update fx rates"
  ON public.fx_rates FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete fx rates"
  ON public.fx_rates FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER fx_rates_set_updated_at
  BEFORE UPDATE ON public.fx_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Placeholder starting rates (Rupiah per unit). Admin must set real values.
INSERT INTO public.fx_rates (quote_currency_code, rate, source)
SELECT c.code,
       CASE c.code
         WHEN 'USD' THEN 16500
         WHEN 'AUD' THEN 11000
         WHEN 'NZD' THEN 10000
         WHEN 'EUR' THEN 18000
       END,
       'manual_seed'
FROM public.currencies c
WHERE c.code IN ('USD', 'AUD', 'NZD', 'EUR');

-- Frozen FX on the commercial records.
ALTER TABLE public.purchases
  ADD COLUMN customer_currency_code text REFERENCES public.currencies(code),
  ADD COLUMN fx_rate numeric(20, 6),
  ADD COLUMN fx_effective_at timestamp with time zone,
  ADD COLUMN customer_total_amount bigint,
  ADD COLUMN customer_first_payment_amount bigint,
  ADD COLUMN customer_outstanding_amount bigint,
  ADD CONSTRAINT purchases_fx_rate_positive CHECK (fx_rate IS NULL OR fx_rate > 0),
  ADD CONSTRAINT purchases_customer_amounts_nonnegative CHECK (
    (customer_total_amount IS NULL OR customer_total_amount >= 0)
    AND (customer_first_payment_amount IS NULL OR customer_first_payment_amount >= 0)
    AND (customer_outstanding_amount IS NULL OR customer_outstanding_amount >= 0)
  );

ALTER TABLE public.payment_requests
  ADD COLUMN customer_currency_code text REFERENCES public.currencies(code),
  ADD COLUMN fx_rate numeric(20, 6),
  ADD COLUMN customer_amount bigint,
  ADD CONSTRAINT payment_requests_fx_rate_positive CHECK (fx_rate IS NULL OR fx_rate > 0),
  ADD CONSTRAINT payment_requests_customer_amount_nonnegative CHECK (
    customer_amount IS NULL OR customer_amount >= 0
  );
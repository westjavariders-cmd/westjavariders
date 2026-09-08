-- Operational (non-commercial) booking state, deliberately separate from payment status
CREATE TYPE public.purchase_fulfillment_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
  email text NOT NULL CHECK (position('@' in email) > 1),
  phone text NOT NULL CHECK (length(btrim(phone)) >= 6),
  country text,
  preferred_language_code text REFERENCES public.languages(code),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_email_key ON public.customers (lower(btrim(email)));

GRANT SELECT ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend the existing purchase entity
CREATE SEQUENCE public.purchase_reference_seq START 1001;
GRANT USAGE ON SEQUENCE public.purchase_reference_seq TO service_role;

ALTER TABLE public.purchases
  ADD COLUMN customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN reference text UNIQUE,
  ADD COLUMN fulfillment_status public.purchase_fulfillment_status NOT NULL DEFAULT 'not_started';

CREATE INDEX purchases_customer_idx ON public.purchases(customer_id);

-- Atomic checkout, now including the customer link and booking reference.
DROP FUNCTION IF EXISTS public.create_purchase(uuid, bigint, numeric, bigint, bigint, jsonb);

CREATE OR REPLACE FUNCTION public.create_purchase(
  _cart_id uuid,
  _customer_id uuid,
  _total_idr bigint,
  _percentage numeric,
  _first_payment_idr bigint,
  _outstanding_idr bigint,
  _snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM purchases WHERE cart_id = _cart_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO purchases (cart_id, customer_id, reference, total_idr, first_payment_percentage, first_payment_idr, outstanding_idr)
  VALUES (
    _cart_id,
    _customer_id,
    'CBR-' || nextval('purchase_reference_seq')::text,
    _total_idr, _percentage, _first_payment_idr, _outstanding_idr
  )
  RETURNING id INTO v_id;

  INSERT INTO purchase_snapshots (purchase_id, data) VALUES (v_id, _snapshot);

  INSERT INTO payment_requests (purchase_id, kind, amount_idr)
  VALUES (v_id, 'first_payment', _first_payment_idr);

  UPDATE carts SET status = 'converted' WHERE id = _cart_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) TO service_role;
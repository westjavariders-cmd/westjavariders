-- Enums
CREATE TYPE public.purchase_status AS ENUM ('pending_payment', 'partially_paid', 'paid', 'cancelled');
CREATE TYPE public.payment_request_kind AS ENUM ('first_payment', 'balance');
CREATE TYPE public.payment_request_status AS ENUM ('created', 'pending', 'paid', 'failed', 'expired', 'cancelled');

-- Purchases
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL UNIQUE REFERENCES public.carts(id),
  status public.purchase_status NOT NULL DEFAULT 'pending_payment',
  currency_code text NOT NULL DEFAULT 'IDR' REFERENCES public.currencies(code),
  total_idr bigint NOT NULL CHECK (total_idr >= 0),
  first_payment_percentage numeric(5,2) NOT NULL CHECK (first_payment_percentage >= 0 AND first_payment_percentage <= 100),
  first_payment_idr bigint NOT NULL CHECK (first_payment_idr >= 0),
  outstanding_idr bigint NOT NULL CHECK (outstanding_idr >= 0),
  paid_idr bigint NOT NULL DEFAULT 0 CHECK (paid_idr >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchases_money_invariant CHECK (first_payment_idr + outstanding_idr = total_idr),
  CONSTRAINT purchases_first_payment_bound CHECK (first_payment_idr <= total_idr)
);

GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read purchases" ON public.purchases
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE TRIGGER purchases_set_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutable snapshot
CREATE TABLE public.purchase_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.purchases(id),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.purchase_snapshots TO authenticated;
GRANT ALL ON public.purchase_snapshots TO service_role;
ALTER TABLE public.purchase_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read purchase snapshots" ON public.purchase_snapshots
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE OR REPLACE FUNCTION public.prevent_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'purchase_snapshots is immutable; rows cannot be modified or deleted';
END;
$$;

CREATE TRIGGER purchase_snapshots_no_update BEFORE UPDATE ON public.purchase_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_snapshot_mutation();
CREATE TRIGGER purchase_snapshots_no_delete BEFORE DELETE ON public.purchase_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prevent_snapshot_mutation();

-- Payment requests (provider-neutral)
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id),
  kind public.payment_request_kind NOT NULL,
  status public.payment_request_status NOT NULL DEFAULT 'created',
  amount_idr bigint NOT NULL CHECK (amount_idr >= 0),
  currency_code text NOT NULL DEFAULT 'IDR' REFERENCES public.currencies(code),
  provider text,
  provider_reference text,
  provider_payment_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_requests_purchase_idx ON public.payment_requests(purchase_id);
CREATE UNIQUE INDEX payment_requests_provider_reference_key
  ON public.payment_requests(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
-- At most one collectable request per amount type; retries reuse it.
CREATE UNIQUE INDEX payment_requests_one_open_per_kind
  ON public.payment_requests(purchase_id, kind)
  WHERE status IN ('created', 'pending', 'paid');

GRANT SELECT ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read payment requests" ON public.payment_requests
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE TRIGGER payment_requests_set_updated_at BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Provider notifications (append-only, idempotent)
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid REFERENCES public.payment_requests(id),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX payment_events_request_idx ON public.payment_events(payment_request_id);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read payment events" ON public.payment_events
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE TRIGGER payment_events_no_update BEFORE UPDATE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();
CREATE TRIGGER payment_events_no_delete BEFORE DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- Atomic checkout: purchase + snapshot + first payment request + cart conversion.
-- Idempotent: a cart already converted returns its existing purchase.
CREATE OR REPLACE FUNCTION public.create_purchase(
  _cart_id uuid,
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

  INSERT INTO purchases (cart_id, total_idr, first_payment_percentage, first_payment_idr, outstanding_idr)
  VALUES (_cart_id, _total_idr, _percentage, _first_payment_idr, _outstanding_idr)
  RETURNING id INTO v_id;

  INSERT INTO purchase_snapshots (purchase_id, data) VALUES (v_id, _snapshot);

  INSERT INTO payment_requests (purchase_id, kind, amount_idr)
  VALUES (v_id, 'first_payment', _first_payment_idr);

  UPDATE carts SET status = 'converted' WHERE id = _cart_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase(uuid, bigint, numeric, bigint, bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase(uuid, bigint, numeric, bigint, bigint, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_purchase(uuid, bigint, numeric, bigint, bigint, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(uuid, bigint, numeric, bigint, bigint, jsonb) TO service_role;
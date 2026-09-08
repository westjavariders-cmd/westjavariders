-- Gift data on the existing purchase (commercial record), not a separate system.
ALTER TABLE public.purchases
  ADD COLUMN is_gift boolean NOT NULL DEFAULT false,
  ADD COLUMN gift_recipient_name text,
  ADD COLUMN gift_message text;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_gift_message_len CHECK (gift_message IS NULL OR char_length(gift_message) <= 200);

CREATE TYPE public.voucher_type AS ENUM ('STANDARD', 'GIFT');

-- Global, atomic, year-scoped voucher numbering. Server-side only.
CREATE TABLE public.voucher_sequences (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.voucher_sequences TO service_role;
ALTER TABLE public.voucher_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voucher_sequences_no_client_access" ON public.voucher_sequences
  FOR SELECT TO authenticated USING (false);

CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.purchases(id),
  customer_id uuid REFERENCES public.customers(id),
  voucher_type public.voucher_type NOT NULL DEFAULT 'STANDARD',
  status public.voucher_status NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz NOT NULL DEFAULT now(),
  validity_months integer NOT NULL,
  valid_until timestamptz NOT NULL,
  entitlement jsonb NOT NULL DEFAULT '{}'::jsonb,
  gift_recipient_name text,
  gift_message text,
  redeemed_at timestamptz,
  redeemed_by uuid,
  redemption_note text,
  cancelled_at timestamptz,
  representation_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vouchers_gift_message_len CHECK (gift_message IS NULL OR char_length(gift_message) <= 200),
  CONSTRAINT vouchers_validity_months CHECK (validity_months >= 1)
);

CREATE INDEX vouchers_customer_idx ON public.vouchers (customer_id);
CREATE INDEX vouchers_status_idx ON public.vouchers (status);
CREATE INDEX vouchers_type_idx ON public.vouchers (voucher_type);

GRANT SELECT ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vouchers_staff_read" ON public.vouchers
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());

CREATE TRIGGER vouchers_set_updated_at BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER voucher_sequences_set_updated_at BEFORE UPDATE ON public.voucher_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic, globally unique voucher number: CBR-YYYY-NNN.
CREATE OR REPLACE FUNCTION public.next_voucher_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year integer := EXTRACT(YEAR FROM now())::integer;
  _next integer;
BEGIN
  INSERT INTO public.voucher_sequences (year, last_value)
  VALUES (_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = public.voucher_sequences.last_value + 1
  RETURNING last_value INTO _next;

  RETURN 'CBR-' || _year::text || '-' || lpad(_next::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_voucher_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_voucher_code() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_voucher_code() TO service_role;

-- Idempotent issuance: one voucher per purchase, number assigned once.
CREATE OR REPLACE FUNCTION public.issue_voucher(
  _purchase_id uuid,
  _validity_months integer,
  _entitlement jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _purchase record;
  _id uuid;
BEGIN
  SELECT id INTO _existing FROM public.vouchers WHERE purchase_id = _purchase_id;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  SELECT id, customer_id, is_gift, gift_recipient_name, gift_message, paid_idr, status
    INTO _purchase
  FROM public.purchases WHERE id = _purchase_id;

  IF _purchase.id IS NULL THEN
    RAISE EXCEPTION 'purchase_not_found';
  END IF;
  IF _purchase.status = 'cancelled' THEN
    RAISE EXCEPTION 'purchase_cancelled';
  END IF;
  IF _purchase.paid_idr <= 0 THEN
    RAISE EXCEPTION 'payment_not_confirmed';
  END IF;

  INSERT INTO public.vouchers (
    code, purchase_id, customer_id, voucher_type, status,
    validity_months, valid_until, entitlement,
    gift_recipient_name, gift_message
  ) VALUES (
    public.next_voucher_code(),
    _purchase_id,
    _purchase.customer_id,
    CASE WHEN _purchase.is_gift THEN 'GIFT'::public.voucher_type ELSE 'STANDARD'::public.voucher_type END,
    'ACTIVE',
    _validity_months,
    now() + make_interval(months => _validity_months),
    COALESCE(_entitlement, '{}'::jsonb),
    _purchase.gift_recipient_name,
    _purchase.gift_message
  )
  ON CONFLICT (purchase_id) DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.vouchers WHERE purchase_id = _purchase_id;
  END IF;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_voucher(uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_voucher(uuid, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_voucher(uuid, integer, jsonb) TO service_role;

-- Existing purchase creation extended with gift details (no parallel system).
CREATE OR REPLACE FUNCTION public.create_purchase(
  _cart_id uuid,
  _customer_id uuid,
  _total_idr bigint,
  _percentage numeric,
  _first_payment_idr bigint,
  _outstanding_idr bigint,
  _snapshot jsonb,
  _is_gift boolean DEFAULT false,
  _gift_recipient_name text DEFAULT NULL,
  _gift_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _purchase_id uuid;
BEGIN
  SELECT id INTO _existing FROM public.purchases WHERE cart_id = _cart_id;
  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  INSERT INTO public.purchases (
    cart_id, customer_id, reference, status, currency_code, total_idr,
    first_payment_percentage, first_payment_idr, outstanding_idr, paid_idr,
    is_gift, gift_recipient_name, gift_message
  ) VALUES (
    _cart_id, _customer_id, 'CBR-' || nextval('purchase_reference_seq')::text,
    'pending_payment', 'IDR', _total_idr,
    _percentage, _first_payment_idr, _outstanding_idr, 0,
    COALESCE(_is_gift, false), _gift_recipient_name, _gift_message
  )
  RETURNING id INTO _purchase_id;

  INSERT INTO public.purchase_snapshots (purchase_id, data) VALUES (_purchase_id, _snapshot);

  INSERT INTO public.payment_requests (purchase_id, kind, status, amount_idr, currency_code)
  VALUES (_purchase_id, 'first_payment', 'created', _first_payment_idr, 'IDR');

  UPDATE public.carts SET status = 'converted' WHERE id = _cart_id;

  RETURN _purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) TO service_role;

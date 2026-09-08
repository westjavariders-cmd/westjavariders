-- One voucher per purchased Package; all vouchers stay linked to their Purchase.
ALTER TABLE public.vouchers
  ADD COLUMN package_id uuid REFERENCES public.packages(id);

-- No vouchers exist yet, so the link can be required immediately.
DELETE FROM public.vouchers WHERE package_id IS NULL;
ALTER TABLE public.vouchers ALTER COLUMN package_id SET NOT NULL;

ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_purchase_id_key;
ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_package_id_key UNIQUE (package_id);

CREATE INDEX IF NOT EXISTS vouchers_purchase_idx ON public.vouchers (purchase_id);

-- Issuance is now per package, still idempotent on payment replays.
DROP FUNCTION IF EXISTS public.issue_voucher(uuid, integer, jsonb);

CREATE OR REPLACE FUNCTION public.issue_voucher(
  _purchase_id uuid,
  _package_id uuid,
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
  SELECT id INTO _existing FROM public.vouchers WHERE package_id = _package_id;
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
    code, purchase_id, package_id, customer_id, voucher_type, status,
    validity_months, valid_until, entitlement,
    gift_recipient_name, gift_message
  ) VALUES (
    public.next_voucher_code(),
    _purchase_id,
    _package_id,
    _purchase.customer_id,
    CASE WHEN _purchase.is_gift THEN 'GIFT'::public.voucher_type ELSE 'STANDARD'::public.voucher_type END,
    'ACTIVE',
    _validity_months,
    now() + make_interval(months => _validity_months),
    COALESCE(_entitlement, '{}'::jsonb),
    _purchase.gift_recipient_name,
    _purchase.gift_message
  )
  ON CONFLICT (package_id) DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.vouchers WHERE package_id = _package_id;
  END IF;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) TO service_role;
ALTER TYPE public.voucher_status ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE public.voucher_status ADD VALUE IF NOT EXISTS 'PAID';

ALTER TABLE public.vouchers ALTER COLUMN purchase_id DROP NOT NULL;
ALTER TABLE public.vouchers ALTER COLUMN package_id DROP NOT NULL;

ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_package_id_fkey;
ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE SET NULL;

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cart_snapshot jsonb;

ALTER TABLE public.saved_trips
  ADD COLUMN IF NOT EXISTS cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS saved_trips_cart_id_key ON public.saved_trips (cart_id) WHERE cart_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text NOT NULL,
  message text NOT NULL,
  cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  voucher_codes text[] NOT NULL DEFAULT '{}',
  email_status text NOT NULL DEFAULT 'PENDING',
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can read contact requests"
  ON public.contact_requests FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE TRIGGER contact_requests_set_updated_at
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON public.contact_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS vouchers_cart_id_idx ON public.vouchers (cart_id);
-- Package: one completed (or in-progress) product configuration with a PROVISIONAL quote.
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','complete')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_idr bigint NOT NULL DEFAULT 0 CHECK (subtotal_idr >= 0),
  season_discount_idr bigint NOT NULL DEFAULT 0 CHECK (season_discount_idr >= 0),
  promo_discount_idr bigint NOT NULL DEFAULT 0 CHECK (promo_discount_idr >= 0),
  total_idr bigint NOT NULL DEFAULT 0 CHECK (total_idr >= 0),
  season_month smallint CHECK (season_month BETWEEN 1 AND 12),
  season_period public.season_period,
  promo_code text,
  promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  quoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX packages_product_idx ON public.packages(product_id);
CREATE INDEX packages_status_idx ON public.packages(status);

-- Cart: anonymous in V1, identified by a private high-entropy session token.
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL UNIQUE CHECK (char_length(session_token) BETWEEN 32 AND 128),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','converted','abandoned')),
  market_code text REFERENCES public.markets(code) ON DELETE SET NULL,
  currency_code text REFERENCES public.currencies(code) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carts_status_idx ON public.carts(status);

CREATE TABLE public.cart_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id)
);
CREATE INDEX cart_packages_cart_idx ON public.cart_packages(cart_id, position);

CREATE TRIGGER packages_set_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER carts_set_updated_at BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cart_packages_set_updated_at BEFORE UPDATE ON public.cart_packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants: no anon access at all. Staff/Admin read for support; writes are server-side only.
GRANT SELECT ON public.packages TO authenticated;
GRANT DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
GRANT SELECT ON public.carts TO authenticated;
GRANT DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
GRANT SELECT ON public.cart_packages TO authenticated;
GRANT DELETE ON public.cart_packages TO authenticated;
GRANT ALL ON public.cart_packages TO service_role;

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_read_staff" ON public.packages FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());
CREATE POLICY "packages_delete_admin" ON public.packages FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "carts_read_staff" ON public.carts FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());
CREATE POLICY "carts_delete_admin" ON public.carts FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "cart_packages_read_staff" ON public.cart_packages FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());
CREATE POLICY "cart_packages_delete_admin" ON public.cart_packages FOR DELETE TO authenticated
  USING (public.is_admin());
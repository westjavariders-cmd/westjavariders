CREATE TYPE public.season_period AS ENUM ('HIGH','MID','LOW');

CREATE TABLE public.product_season_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_season_settings TO authenticated;
GRANT ALL ON public.product_season_settings TO service_role;
ALTER TABLE public.product_season_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_settings_read" ON public.product_season_settings FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "season_settings_write" ON public.product_season_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER product_season_settings_set_updated_at BEFORE UPDATE ON public.product_season_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_season_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  period public.season_period NOT NULL,
  discount_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, period)
);
CREATE INDEX product_season_periods_product_idx ON public.product_season_periods(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_season_periods TO authenticated;
GRANT ALL ON public.product_season_periods TO service_role;
ALTER TABLE public.product_season_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_periods_read" ON public.product_season_periods FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "season_periods_write" ON public.product_season_periods FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER product_season_periods_set_updated_at BEFORE UPDATE ON public.product_season_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_season_months (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  month smallint NOT NULL CHECK (month >= 1 AND month <= 12),
  period public.season_period NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, month)
);
CREATE INDEX product_season_months_product_idx ON public.product_season_months(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_season_months TO authenticated;
GRANT ALL ON public.product_season_months TO service_role;
ALTER TABLE public.product_season_months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_months_read" ON public.product_season_months FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "season_months_write" ON public.product_season_months FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER product_season_months_set_updated_at BEFORE UPDATE ON public.product_season_months FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code = upper(code) AND length(code) BETWEEN 2 AND 40),
  internal_name text NOT NULL,
  discount_percentage numeric(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  expires_at timestamptz,
  gift_eligible boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX promo_codes_active_idx ON public.promo_codes(active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_read" ON public.promo_codes FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "promo_codes_write" ON public.promo_codes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER promo_codes_set_updated_at BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.promo_code_products (
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promo_code_id, product_id)
);
CREATE INDEX promo_code_products_product_idx ON public.promo_code_products(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_code_products TO authenticated;
GRANT ALL ON public.promo_code_products TO service_role;
ALTER TABLE public.promo_code_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_code_products_read" ON public.promo_code_products FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "promo_code_products_write" ON public.promo_code_products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.promo_code_categories (
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promo_code_id, category_id)
);
CREATE INDEX promo_code_categories_category_idx ON public.promo_code_categories(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_code_categories TO authenticated;
GRANT ALL ON public.promo_code_categories TO service_role;
ALTER TABLE public.promo_code_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_code_categories_read" ON public.promo_code_categories FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "promo_code_categories_write" ON public.promo_code_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TYPE public.pricing_mode AS ENUM ('structured', 'formula');
CREATE TYPE public.pricing_rule_type AS ENUM ('fixed', 'variable_times_amount', 'component_quantity', 'conditional', 'tier');
CREATE TYPE public.pricing_sign AS ENUM ('add', 'subtract');

CREATE TABLE public.product_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  base_amount_idr bigint NOT NULL DEFAULT 0 CHECK (base_amount_idr >= 0),
  mode public.pricing_mode NOT NULL DEFAULT 'structured',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  active_version_id uuid,
  people_variable text,
  days_variable text,
  nights_variable text,
  sessions_variable text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pricing TO authenticated;
GRANT ALL ON public.product_pricing TO service_role;
ALTER TABLE public.product_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_read" ON public.product_pricing FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "pricing_write" ON public.product_pricing FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER product_pricing_set_updated_at BEFORE UPDATE ON public.product_pricing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id uuid NOT NULL REFERENCES public.product_pricing(id) ON DELETE CASCADE,
  rule_type public.pricing_rule_type NOT NULL,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  amount_idr bigint,
  variable_name text,
  component_id uuid REFERENCES public.product_components(id) ON DELETE CASCADE,
  condition_variable text,
  condition_operator text,
  condition_value text,
  sign public.pricing_sign NOT NULL DEFAULT 'add',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pricing_rules_pricing_idx ON public.pricing_rules (pricing_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_rules_read" ON public.pricing_rules FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "pricing_rules_write" ON public.pricing_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER pricing_rules_set_updated_at BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.pricing_rules(id) ON DELETE CASCADE,
  from_value numeric NOT NULL,
  to_value numeric,
  amount_idr bigint NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pricing_tiers_rule_idx ON public.pricing_tiers (rule_id, display_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_tiers TO authenticated;
GRANT ALL ON public.pricing_tiers TO service_role;
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_tiers_read" ON public.pricing_tiers FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "pricing_tiers_write" ON public.pricing_tiers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER pricing_tiers_set_updated_at BEFORE UPDATE ON public.pricing_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id uuid NOT NULL REFERENCES public.product_pricing(id) ON DELETE CASCADE,
  version integer NOT NULL,
  expression text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pricing_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formula_versions TO authenticated;
GRANT ALL ON public.formula_versions TO service_role;
ALTER TABLE public.formula_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formula_versions_read" ON public.formula_versions FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "formula_versions_write" ON public.formula_versions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER formula_versions_set_updated_at BEFORE UPDATE ON public.formula_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_pricing
  ADD CONSTRAINT product_pricing_active_version_fkey
  FOREIGN KEY (active_version_id) REFERENCES public.formula_versions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.prevent_active_formula_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active AND NEW.expression IS DISTINCT FROM OLD.expression THEN
    RAISE EXCEPTION 'An active formula version is immutable; create a new version instead';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER formula_versions_immutable BEFORE UPDATE ON public.formula_versions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_active_formula_edit();

CREATE TABLE public.pricing_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id uuid NOT NULL REFERENCES public.product_pricing(id) ON DELETE CASCADE,
  label text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_total_idr bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pricing_test_cases_pricing_idx ON public.pricing_test_cases (pricing_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_test_cases TO authenticated;
GRANT ALL ON public.pricing_test_cases TO service_role;
ALTER TABLE public.pricing_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_test_cases_read" ON public.pricing_test_cases FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "pricing_test_cases_write" ON public.pricing_test_cases FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER pricing_test_cases_set_updated_at BEFORE UPDATE ON public.pricing_test_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.product_kind NOT NULL,
  internal_name text NOT NULL,
  internal_ref text UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive','archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read products" ON public.products FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write products" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT TRANSLATIONS
CREATE TABLE public.product_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  title text,
  summary text,
  body text,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, language_code)
);
CREATE INDEX product_translations_product_idx ON public.product_translations(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_translations TO authenticated;
GRANT ALL ON public.product_translations TO service_role;
ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read product translations" ON public.product_translations FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write product translations" ON public.product_translations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER product_translations_set_updated_at BEFORE UPDATE ON public.product_translations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read categories" ON public.categories FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write categories" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PLACEMENTS
CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.placements TO authenticated;
GRANT ALL ON public.placements TO service_role;
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read placements" ON public.placements FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write placements" ON public.placements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER placements_set_updated_at BEFORE UPDATE ON public.placements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT CATEGORIES
CREATE TABLE public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read product categories" ON public.product_categories FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write product categories" ON public.product_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRODUCT PLACEMENTS
CREATE TABLE public.product_placements (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, placement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_placements TO authenticated;
GRANT ALL ON public.product_placements TO service_role;
ALTER TABLE public.product_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read product placements" ON public.product_placements FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write product placements" ON public.product_placements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- COMPONENT TEMPLATES
CREATE TABLE public.component_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name text NOT NULL,
  customer_name text,
  customer_description text,
  unit_basis public.unit_basis NOT NULL DEFAULT 'fixed',
  internal_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (internal_cost >= 0),
  customer_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (customer_price >= 0),
  min_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  max_quantity numeric(12,2) CHECK (max_quantity IS NULL OR max_quantity >= 0),
  default_quantity numeric(12,2),
  season_eligible boolean NOT NULL DEFAULT false,
  promo_eligible boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_templates TO authenticated;
GRANT ALL ON public.component_templates TO service_role;
ALTER TABLE public.component_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read component templates" ON public.component_templates FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write component templates" ON public.component_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER component_templates_set_updated_at BEFORE UPDATE ON public.component_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT COMPONENTS (independent copies)
CREATE TABLE public.product_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source_template_id uuid REFERENCES public.component_templates(id) ON DELETE SET NULL,
  internal_name text NOT NULL,
  customer_name text,
  customer_description text,
  unit_basis public.unit_basis NOT NULL DEFAULT 'fixed',
  internal_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (internal_cost >= 0),
  customer_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (customer_price >= 0),
  min_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  max_quantity numeric(12,2) CHECK (max_quantity IS NULL OR max_quantity >= 0),
  default_quantity numeric(12,2),
  season_eligible boolean NOT NULL DEFAULT false,
  promo_eligible boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_components_product_idx ON public.product_components(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_components TO authenticated;
GRANT ALL ON public.product_components TO service_role;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read product components" ON public.product_components FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write product components" ON public.product_components FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER product_components_set_updated_at BEFORE UPDATE ON public.product_components FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONFIG FLOWS
CREATE TABLE public.config_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  internal_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_flows TO authenticated;
GRANT ALL ON public.config_flows TO service_role;
ALTER TABLE public.config_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read config flows" ON public.config_flows FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write config flows" ON public.config_flows FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER config_flows_set_updated_at BEFORE UPDATE ON public.config_flows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STEPS
CREATE TABLE public.steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.config_flows(id) ON DELETE CASCADE,
  internal_name text NOT NULL,
  customer_title text,
  customer_description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX steps_flow_idx ON public.steps(flow_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.steps TO authenticated;
GRANT ALL ON public.steps TO service_role;
ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read steps" ON public.steps FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write steps" ON public.steps FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER steps_set_updated_at BEFORE UPDATE ON public.steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FIELDS
CREATE TABLE public.fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.steps(id) ON DELETE CASCADE,
  internal_name text NOT NULL,
  variable_name text NOT NULL CHECK (variable_name ~ '^[a-z][a-z0-9_]*$'),
  customer_label text,
  help_text text,
  field_type public.field_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  default_value text,
  min_value numeric(12,2),
  max_value numeric(12,2),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, variable_name)
);
CREATE INDEX fields_step_idx ON public.fields(step_id);
CREATE INDEX fields_product_idx ON public.fields(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read fields" ON public.fields FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write fields" ON public.fields FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER fields_set_updated_at BEFORE UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FIELD OPTIONS
CREATE TABLE public.field_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  internal_value text NOT NULL,
  customer_label text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_id, internal_value)
);
CREATE INDEX field_options_field_idx ON public.field_options(field_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_options TO authenticated;
GRANT ALL ON public.field_options TO service_role;
ALTER TABLE public.field_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read field options" ON public.field_options FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write field options" ON public.field_options FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER field_options_set_updated_at BEFORE UPDATE ON public.field_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEPENDENCIES
CREATE TABLE public.dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source_field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  source_option_id uuid REFERENCES public.field_options(id) ON DELETE CASCADE,
  operator text NOT NULL CHECK (operator IN ('equals','not_equals','greater_than','less_than','is_empty','is_not_empty','is_true','is_false','contains')),
  compare_value text,
  action public.dependency_action NOT NULL,
  action_value text,
  target_field_id uuid REFERENCES public.fields(id) ON DELETE CASCADE,
  target_option_id uuid REFERENCES public.field_options(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_field_id IS NOT NULL OR target_option_id IS NOT NULL)
);
CREATE INDEX dependencies_product_idx ON public.dependencies(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dependencies TO authenticated;
GRANT ALL ON public.dependencies TO service_role;
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admins can read dependencies" ON public.dependencies FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins can write dependencies" ON public.dependencies FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER dependencies_set_updated_at BEFORE UPDATE ON public.dependencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
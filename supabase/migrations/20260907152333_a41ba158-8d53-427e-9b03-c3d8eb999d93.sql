-- =========================================================
-- PHASE 1A: FOUNDATIONS + SECURITY
-- =========================================================

-- ---------- 1. ENUMS ----------
CREATE TYPE public.product_kind      AS ENUM ('package', 'insurance');
CREATE TYPE public.order_line_kind   AS ENUM ('package', 'insurance');
CREATE TYPE public.payment_status    AS ENUM ('PAYMENT_PENDING', 'PARTIALLY_PAID', 'FULLY_PAID', 'PAYMENT_FAILED', 'PAYMENT_UNKNOWN');
CREATE TYPE public.voucher_status    AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');
CREATE TYPE public.field_type        AS ENUM ('single_select', 'multi_select', 'quantity', 'number', 'text', 'date', 'date_range', 'boolean', 'info_block');
CREATE TYPE public.dependency_action AS ENUM ('show', 'hide', 'require', 'enable', 'disable', 'set_value', 'set_minimum', 'set_maximum', 'reset_remove');
CREATE TYPE public.unit_basis        AS ENUM ('fixed', 'per_person', 'per_day', 'per_night', 'per_session');
CREATE TYPE public.user_role         AS ENUM ('ADMIN', 'STAFF');

-- ---------- 2. MONEY STORAGE CONVENTION ----------
-- Integer-safe money only. Never float/real/double for money.
CREATE DOMAIN public.idr_amount AS BIGINT;
COMMENT ON DOMAIN public.idr_amount IS
  'Internal base currency amount in whole Indonesian Rupiah (IDR has no minor unit). Integer-safe; never floating point.';

CREATE DOMAIN public.currency_amount AS BIGINT;
COMMENT ON DOMAIN public.currency_amount IS
  'Customer-facing amount in whole units of the customer currency, after FX conversion and round-up. Integer-safe; never floating point.';

CREATE DOMAIN public.percentage_bp AS INTEGER;
COMMENT ON DOMAIN public.percentage_bp IS
  'Percentage expressed in basis points (10000 = 100%). Used for discounts and payment splits so no float is needed. Intermediate pricing precision is handled by the pricing engine using exact numeric, never float.';

-- ---------- 3. SHARED TRIGGER FUNCTION ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- 4. ROLES + ROLE CHECK (security definer, non-recursive) ----------
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  role       public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX user_roles_user_id_idx ON public.user_roles (user_id);
COMMENT ON TABLE public.user_roles IS 'Admin/Staff roles. Roles are NEVER stored on a profile column. Customers have no accounts and never appear here.';

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'ADMIN'::public.user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('ADMIN'::public.user_role, 'STAFF'::public.user_role)
  );
$$;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can read roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- 5. SETTINGS ----------
CREATE TABLE public.settings (
  key         TEXT PRIMARY KEY CHECK (key = lower(key) AND length(key) > 0),
  value       TEXT NOT NULL,
  value_type  TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'integer', 'decimal', 'boolean', 'json')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.settings IS 'Global configuration defaults. Historical purchases and vouchers store their own actual values; changing a setting must never alter history.';
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can read settings"
  ON public.settings FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins can insert settings"
  ON public.settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update settings"
  ON public.settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete settings"
  ON public.settings FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------- 6. CURRENCIES ----------
CREATE TABLE public.currencies (
  code          TEXT PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  name          TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  is_base       BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX currencies_single_base_idx ON public.currencies (is_base) WHERE is_base;
CREATE INDEX currencies_active_order_idx ON public.currencies (is_active, display_order);
CREATE TRIGGER currencies_set_updated_at BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.currencies TO anon, authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read currencies"
  ON public.currencies FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can insert currencies"
  ON public.currencies FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update currencies"
  ON public.currencies FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete currencies"
  ON public.currencies FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 7. LANGUAGES ----------
CREATE TABLE public.languages (
  code          TEXT PRIMARY KEY CHECK (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  name          TEXT NOT NULL,
  native_name   TEXT,
  is_master     BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX languages_single_master_idx ON public.languages (is_master) WHERE is_master;
CREATE INDEX languages_active_order_idx ON public.languages (is_active, display_order);
CREATE TRIGGER languages_set_updated_at BEFORE UPDATE ON public.languages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.languages TO anon, authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read languages"
  ON public.languages FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can insert languages"
  ON public.languages FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update languages"
  ON public.languages FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete languages"
  ON public.languages FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 8. MARKETS ----------
CREATE TABLE public.markets (
  code                  TEXT PRIMARY KEY CHECK (code = upper(code) AND length(code) BETWEEN 2 AND 16),
  name                  TEXT NOT NULL,
  default_currency_code TEXT NOT NULL REFERENCES public.currencies (code) ON UPDATE CASCADE ON DELETE RESTRICT,
  default_language_code TEXT NOT NULL REFERENCES public.languages (code) ON UPDATE CASCADE ON DELETE RESTRICT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  display_order         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.markets IS 'Market is separate from language. Defaults only; the customer can override currency and language.';
CREATE INDEX markets_currency_idx ON public.markets (default_currency_code);
CREATE INDEX markets_language_idx ON public.markets (default_language_code);
CREATE INDEX markets_active_order_idx ON public.markets (is_active, display_order);
CREATE TRIGGER markets_set_updated_at BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.markets TO anon, authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read markets"
  ON public.markets FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can insert markets"
  ON public.markets FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update markets"
  ON public.markets FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete markets"
  ON public.markets FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 9. ADMIN AUDIT LOG (append-only) ----------
CREATE TABLE public.admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  action      TEXT NOT NULL CHECK (length(action) > 0),
  entity_type TEXT NOT NULL CHECK (length(entity_type) > 0),
  entity_id   UUID,
  entity_ref  TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_audit_log IS 'Lightweight append-only record of important administrative actions (price changes, activations, voucher/payment status changes, corrections). Not an enterprise audit system.';
CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_entity_idx ON public.admin_audit_log (entity_type, entity_id);
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log (actor_id);

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only; rows cannot be modified or deleted';
END;
$$;

CREATE TRIGGER admin_audit_log_no_update
  BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE TRIGGER admin_audit_log_no_delete
  BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can read the audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Staff and admins can append to the audit log"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin() AND actor_id = auth.uid());

-- Lock down SECURITY DEFINER / helper functions.
-- anon must never be able to probe role state; customers have no accounts at all.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.user_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff_or_admin() FROM PUBLIC, anon;

-- authenticated keeps EXECUTE: RLS policy expressions on settings, user_roles,
-- currencies, languages, markets and admin_audit_log are evaluated as the
-- calling role and must be able to invoke these checks.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;

-- Trigger-only helpers: never callable through the API.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_audit_log_mutation() FROM PUBLIC, anon, authenticated;

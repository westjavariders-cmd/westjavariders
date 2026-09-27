-- Remove all direct execute access from unauthenticated visitors
REVOKE EXECUTE ON FUNCTION public.clear_pricing_variable(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rename_pricing_variable(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_accommodation_room(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_catalogue(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_motorbike(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_product(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.duplicate_transport(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_voucher_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_pricing_variable(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rename_pricing_variable(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_accommodation_room(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_catalogue(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_motorbike(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_product(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicate_transport(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_voucher_code() FROM PUBLIC;

-- Money- and voucher-issuing routines: trusted server side only
REVOKE EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.next_voucher_code() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_purchase(uuid, uuid, bigint, numeric, bigint, bigint, jsonb, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_voucher(uuid, uuid, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_voucher_code() TO service_role;

-- Admin-only routines and role checks stay available to signed-in users;
-- each one already enforces its own ADMIN/STAFF check internally.
GRANT EXECUTE ON FUNCTION public.clear_pricing_variable(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rename_pricing_variable(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_accommodation_room(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_catalogue(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_motorbike(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_product(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_transport(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.user_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, service_role;
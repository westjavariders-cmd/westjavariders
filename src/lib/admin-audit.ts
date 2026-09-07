import { supabase } from "@/integrations/supabase/client";

/**
 * Records an important Admin action. Audit rows are append-only in the
 * database; the row is written as the signed-in staff account.
 * Failures never block the operation the user performed.
 */
export async function recordAdminAction(
  action: string,
  entityType: string,
  entityRef: string | null,
  details: Record<string, unknown> = {},
) {
  const { data } = await supabase.auth.getUser();
  const actorId = data.user?.id;
  if (!actorId) return;
  await supabase
    .from("admin_audit_log")
    .insert({ actor_id: actorId, action, entity_type: entityType, entity_ref: entityRef, details: details as never });
}

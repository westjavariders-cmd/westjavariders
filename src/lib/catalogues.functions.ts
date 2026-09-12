import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATALOGUE_TEMPLATES, validateCatalogue } from "@/lib/catalogues";

/**
 * Catalogue containers: Admin-only writes, validated server-side and audited
 * into the existing admin_audit_log. Items themselves keep using the existing
 * accommodation / transport / motorbike server functions.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class CatalogueError extends Error {}
function fail(message: string): never {
  throw new CatalogueError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change catalogues.");
}

async function audit(
  supabase: any,
  actorId: string,
  action: string,
  entityId: string | null,
  entityRef: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "catalogues",
    entity_id: entityId,
    entity_ref: entityRef,
    details: details as never,
  });
}

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => (v.trim() === "" ? null : v.trim()))
    .nullable()
    .optional();

const catalogueInput = z.object({
  internal_name: z.string().min(1, "An internal name is required.").max(200),
  public_name: nullableText(200),
  description: nullableText(2000),
  // Customer-facing wording for the extra choices a transport item is priced by.
  people_label: nullableText(120),
  hours_label: nullableText(120),
  active: z.boolean(),
});


export const createCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    catalogueInput.extend({ template: z.enum(CATALOGUE_TEMPLATES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const fields = { ...data, internal_name: data.internal_name.trim() };
    const issues = validateCatalogue(fields);
    if (issues.length > 0) fail(issues[0]!);

    const { count } = await supabase.from("catalogues").select("id", { count: "exact", head: true });
    const { data: row, error } = await supabase
      .from("catalogues")
      .insert({ ...fields, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);

    await audit(supabase, userId, "catalogue.created", row.id, fields.internal_name, {
      template: fields.template,
    });
    return { id: row.id as string };
  });

export const updateCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => catalogueInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { id, ...rest } = data;
    const fields = { ...rest, internal_name: rest.internal_name.trim() };
    if (!fields.internal_name) fail("An internal name is required.");

    // The template is structural: it is chosen once, at creation.
    const { error } = await supabase.from("catalogues").update(fields).eq("id", id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "catalogue.updated", id, fields.internal_name);
    return { ok: true };
  });

export const setCatalogueActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase
      .from("catalogues")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(
      supabase,
      userId,
      data.active ? "catalogue.activated" : "catalogue.deactivated",
      data.id,
      null,
    );
    return { ok: true };
  });

export const reorderCatalogues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    for (const [index, id] of data.orderedIds.entries()) {
      const { error } = await supabase.from("catalogues").update({ sort_order: index }).eq("id", id);
      if (error) fail(SAFE_ERROR);
    }
    await audit(supabase, userId, "catalogue.reordered", null, null);
    return { ok: true };
  });

/** A catalogue can only be deleted while it holds no item at all. */
export const deleteCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const counts = await Promise.all(
      ["accommodations", "transports", "motorbikes"].map((table) =>
        supabase.from(table).select("id", { count: "exact", head: true }).eq("catalogue_id", data.id),
      ),
    );
    if (counts.some((c: any) => (c.count ?? 0) > 0)) {
      fail("This catalogue still holds items. Delete or move them first.");
    }

    const { error } = await supabase.from("catalogues").delete().eq("id", data.id);
    if (error) fail("This catalogue could not be deleted.");
    await audit(supabase, userId, "catalogue.deleted", data.id, null);
    return { ok: true };
  });

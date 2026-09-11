import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATALOGUE_TEMPLATES, validateCatalogue } from "@/lib/catalogue";

/**
 * Catalogue instance writes. Admin-only, validated server-side and audited
 * into the existing admin_audit_log. Creating a catalogue never creates new
 * behaviour: it only picks one of the three existing templates.
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
  template: z.enum(CATALOGUE_TEMPLATES),
  internal_name: z.string().min(1, "An internal name is required.").max(200),
  public_name: nullableText(200),
  description: nullableText(4000),
  active: z.boolean(),
});

export const createCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => catalogueInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const issues = validateCatalogue(data);
    if (issues.length > 0) fail(issues[0]!);

    const { count } = await supabase
      .from("catalogues")
      .select("id", { count: "exact", head: true });

    const { data: row, error } = await supabase
      .from("catalogues")
      .insert({
        ...data,
        internal_name: data.internal_name.trim(),
        sort_order: count ?? 0,
      })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);

    await audit(supabase, userId, "catalogue.created", row.id, data.internal_name, {
      template: data.template,
    });
    return { id: row.id as string };
  });

export const updateCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    catalogueInput.omit({ template: true }).extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { id, ...fields } = data;
    if (fields.internal_name.trim() === "") fail("An internal name is required.");

    // The template is fixed at creation: it decides the behaviour of every
    // item already inside the catalogue.
    const { error } = await supabase
      .from("catalogues")
      .update({ ...fields, internal_name: fields.internal_name.trim() })
      .eq("id", id);
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

export const deleteCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("catalogues").delete().eq("id", data.id);
    if (error) {
      fail("This catalogue still contains items. Move or remove them before deleting it.");
    }
    await audit(supabase, userId, "catalogue.deleted", data.id, null);
    return { ok: true };
  });

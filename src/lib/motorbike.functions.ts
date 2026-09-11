import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MOTORBIKE_PHOTO_BUCKET, validateMotorbike } from "@/lib/motorbike";

/**
 * Motorbike catalogue writes. Every mutation is Admin-only, validated
 * server-side and audited into the existing admin_audit_log.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class MotorbikeError extends Error {}
function fail(message: string): never {
  throw new MotorbikeError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change the motorbike catalogue.");
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
    entity_type: "motorbikes",
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

const motorbikeInput = z.object({
  internal_name: z.string().min(1, "An internal name is required.").max(200),
  public_name: nullableText(200),
  internal_reference: nullableText(60),
  description: nullableText(2000),
  internal_notes: nullableText(4000),
  supplier_cost_idr: z.number().int().min(0, "Supplier costs cannot be negative."),
  customer_price_idr: z.number().int().min(0, "Customer prices cannot be negative."),
  active: z.boolean(),
});

export const createMotorbike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => motorbikeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const fields = { ...data, internal_name: data.internal_name.trim() };
    const issues = validateMotorbike(fields);
    if (issues.length > 0) fail(issues[0]!);

    const { count } = await supabase.from("motorbikes").select("id", { count: "exact", head: true });
    const { data: row, error } = await supabase
      .from("motorbikes")
      .insert({ ...fields, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);

    await audit(supabase, userId, "motorbike.created", row.id, fields.internal_name);
    return { id: row.id as string };
  });

export const updateMotorbike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => motorbikeInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { id, ...rest } = data;
    const fields = { ...rest, internal_name: rest.internal_name.trim() };
    const issues = validateMotorbike(fields);
    if (issues.length > 0) fail(issues[0]!);

    const { error } = await supabase.from("motorbikes").update(fields).eq("id", id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "motorbike.updated", id, fields.internal_name);
    return { ok: true };
  });

export const setMotorbikeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("motorbikes").update({ active: data.active }).eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(
      supabase,
      userId,
      data.active ? "motorbike.activated" : "motorbike.deactivated",
      data.id,
      null,
    );
    return { ok: true };
  });

export const deleteMotorbike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { data: row } = await supabase
      .from("motorbikes")
      .select("photo_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabase.from("motorbikes").delete().eq("id", data.id);
    if (error) fail("This motorbike could not be deleted.");

    if (row?.photo_path) {
      const stillUsed = await supabase
        .from("motorbikes")
        .select("id", { count: "exact", head: true })
        .eq("photo_path", row.photo_path);
      if ((stillUsed.count ?? 0) === 0) {
        await supabase.storage.from(MOTORBIKE_PHOTO_BUCKET).remove([row.photo_path]);
      }
    }

    await audit(supabase, userId, "motorbike.deleted", data.id, null);
    return { ok: true };
  });

/** Atomic, independent inactive copy of one motorbike. */
export const duplicateMotorbike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: newId, error } = await supabase.rpc("duplicate_motorbike", { _source: data.id });
    if (error || !newId) fail("This motorbike could not be duplicated.");
    await audit(supabase, userId, "motorbike.duplicated", newId, null, { source_motorbike_id: data.id });
    return { id: newId as string };
  });

export const reorderMotorbikes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    for (const [index, id] of data.orderedIds.entries()) {
      const { error } = await supabase.from("motorbikes").update({ sort_order: index }).eq("id", id);
      if (error) fail(SAFE_ERROR);
    }
    await audit(supabase, userId, "motorbike.reordered", null, null);
    return { ok: true };
  });

/** Records or clears the single optional main photo. */
export const setMotorbikePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), photo_path: z.string().min(1).max(500).nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { data: row } = await supabase
      .from("motorbikes")
      .select("photo_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabase
      .from("motorbikes")
      .update({ photo_path: data.photo_path })
      .eq("id", data.id);
    if (error) fail(SAFE_ERROR);

    const previous = row?.photo_path as string | null | undefined;
    if (previous && previous !== data.photo_path) {
      const stillUsed = await supabase
        .from("motorbikes")
        .select("id", { count: "exact", head: true })
        .eq("photo_path", previous);
      if ((stillUsed.count ?? 0) === 0) {
        await supabase.storage.from(MOTORBIKE_PHOTO_BUCKET).remove([previous]);
      }
    }

    await audit(
      supabase,
      userId,
      data.photo_path ? "motorbike.photo_set" : "motorbike.photo_removed",
      data.id,
      null,
    );
    return { ok: true };
  });

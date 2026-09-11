import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRANSPORT_TYPES, validatePeoplePrices, validateTimePrices, validateTransport } from "@/lib/transport";

/**
 * Transport catalogue writes. Every mutation is Admin-only, validated
 * server-side and audited into the existing admin_audit_log.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class TransportError extends Error {}
function fail(message: string): never {
  throw new TransportError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change the transport catalogue.");
}

async function audit(
  supabase: any,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  entityRef: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
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

const nullableHours = z.number().int().min(1).max(9).nullable().optional();

const transportInput = z.object({
  transport_type: z.enum(TRANSPORT_TYPES),
  internal_name: z.string().min(1, "An internal name is required.").max(200),
  public_name: nullableText(200),
  internal_reference: nullableText(60),
  description: nullableText(4000),
  origin: nullableText(200),
  destination: nullableText(200),
  min_travel_hours: nullableHours,
  max_travel_hours: nullableHours,
  internal_notes: nullableText(4000),
  active: z.boolean(),
});

function normalise(fields: z.infer<typeof transportInput>) {
  return {
    ...fields,
    internal_name: fields.internal_name.trim(),
    min_travel_hours: fields.min_travel_hours ?? null,
    max_travel_hours: fields.max_travel_hours ?? null,
  };
}

export const createTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    transportInput.extend({ catalogue_id: z.string().uuid().nullable().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { catalogue_id, ...input } = data;
    const fields = normalise(input as never);
    const issues = validateTransport(fields);
    if (issues.length > 0) fail(issues[0]!);

    const { resolveCatalogueId } = await import("@/lib/catalogues");
    const catalogueId = await resolveCatalogueId(supabase, "transport", catalogue_id);
    if (!catalogueId) fail("Choose a valid transport catalogue for this item.");

    const { count } = await supabase.from("transports").select("id", { count: "exact", head: true });
    const { data: row, error } = await supabase
      .from("transports")
      .insert({ ...fields, sort_order: count ?? 0, catalogue_id: catalogueId })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);

    await audit(supabase, userId, "transport.created", "transports", row.id, fields.internal_name, {
      transport_type: fields.transport_type,
      catalogue_id: catalogueId,
    });
    return { id: row.id as string };
  });

export const updateTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => transportInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { id, ...rest } = data;
    const fields = normalise(rest as z.infer<typeof transportInput>);
    const issues = validateTransport(fields);
    if (issues.length > 0) fail(issues[0]!);

    const { error } = await supabase.from("transports").update(fields).eq("id", id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "transport.updated", "transports", id, fields.internal_name);
    return { ok: true };
  });

export const setTransportActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("transports").update({ active: data.active }).eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(
      supabase,
      userId,
      data.active ? "transport.activated" : "transport.deactivated",
      "transports",
      data.id,
      null,
    );
    return { ok: true };
  });

export const deleteTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("transports").delete().eq("id", data.id);
    if (error) fail("This transport could not be deleted.");
    await audit(supabase, userId, "transport.deleted", "transports", data.id, null);
    return { ok: true };
  });

/** Atomic, independent copy of one transport including all of its prices. */
export const duplicateTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: newId, error } = await supabase.rpc("duplicate_transport", { _source: data.id });
    if (error || !newId) fail("This transport could not be duplicated.");
    await audit(supabase, userId, "transport.duplicated", "transports", newId, null, {
      source_transport_id: data.id,
    });
    return { id: newId as string };
  });

export const reorderTransports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    for (const [index, id] of data.orderedIds.entries()) {
      const { error } = await supabase.from("transports").update({ sort_order: index }).eq("id", id);
      if (error) fail(SAFE_ERROR);
    }
    await audit(supabase, userId, "transport.reordered", "transports", null, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Pricing                                                            */
/* ------------------------------------------------------------------ */

const moneyRow = {
  supplier_cost_idr: z.number().int().min(0, "Supplier costs cannot be negative."),
  customer_price_idr: z.number().int().min(0, "Customer prices cannot be negative."),
};

export const savePeoplePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transport_id: z.string().uuid(),
        rows: z
          .array(z.object({ people: z.number().int().min(1).max(4), ...moneyRow }))
          .max(4),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const issues = validatePeoplePrices(data.rows);
    if (issues.length > 0) fail(issues[0]!);

    const { data: before, error: beforeError } = await supabase
      .from("transport_people_prices")
      .select("people, supplier_cost_idr, customer_price_idr")
      .eq("transport_id", data.transport_id);
    if (beforeError) fail(SAFE_ERROR);

    const { error: delError } = await supabase
      .from("transport_people_prices")
      .delete()
      .eq("transport_id", data.transport_id);
    if (delError) fail(SAFE_ERROR);

    if (data.rows.length > 0) {
      const { error } = await supabase
        .from("transport_people_prices")
        .insert(data.rows.map((r) => ({ ...r, transport_id: data.transport_id })));
      if (error) fail(SAFE_ERROR);
    }

    await audit(supabase, userId, "transport.people_prices_changed", "transports", data.transport_id, null, {
      from: before ?? [],
      to: data.rows,
    });
    return { ok: true };
  });

export const saveTimePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        transport_id: z.string().uuid(),
        rows: z
          .array(z.object({ travel_hours: z.number().int().min(1).max(9), ...moneyRow }))
          .max(9),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const issues = validateTimePrices(data.rows);
    if (issues.length > 0) fail(issues[0]!);

    const { data: before, error: beforeError } = await supabase
      .from("transport_time_prices")
      .select("travel_hours, supplier_cost_idr, customer_price_idr")
      .eq("transport_id", data.transport_id);
    if (beforeError) fail(SAFE_ERROR);

    const { error: delError } = await supabase
      .from("transport_time_prices")
      .delete()
      .eq("transport_id", data.transport_id);
    if (delError) fail(SAFE_ERROR);

    if (data.rows.length > 0) {
      const { error } = await supabase
        .from("transport_time_prices")
        .insert(data.rows.map((r) => ({ ...r, transport_id: data.transport_id })));
      if (error) fail(SAFE_ERROR);
    }

    await audit(supabase, userId, "transport.time_prices_changed", "transports", data.transport_id, null, {
      from: before ?? [],
      to: data.rows,
    });
    return { ok: true };
  });

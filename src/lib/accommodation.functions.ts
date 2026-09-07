import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACCOMMODATION_TYPES, isRoomSelectable, validateRoom } from "@/lib/accommodation";

/**
 * Accommodation catalogue writes. Every mutation is Admin-only, validated
 * server-side and audited into the existing admin_audit_log.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class AccommodationError extends Error {}
function fail(message: string): never {
  throw new AccommodationError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change the accommodation catalogue.");
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

/* ------------------------------------------------------------------ */
/* Accommodation                                                      */
/* ------------------------------------------------------------------ */

const accommodationInput = z.object({
  accommodation_type: z.enum(ACCOMMODATION_TYPES),
  internal_name: z.string().min(1, "An internal name is required.").max(200),
  public_name: nullableText(200),
  internal_reference: nullableText(60),
  description: nullableText(4000),
  location: nullableText(200),
  supplier_contact: nullableText(1000),
  internal_notes: nullableText(4000),
  active: z.boolean(),
});

export const createAccommodation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => accommodationInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: row, error } = await supabase
      .from("accommodations")
      .insert({ ...data, internal_name: data.internal_name.trim() })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);
    await audit(supabase, userId, "accommodation.created", "accommodations", row.id, data.internal_name, {
      accommodation_type: data.accommodation_type,
    });
    return { id: row.id as string };
  });

export const updateAccommodation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => accommodationInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { id, ...fields } = data;
    const { error } = await supabase
      .from("accommodations")
      .update({ ...fields, internal_name: fields.internal_name.trim() })
      .eq("id", id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "accommodation.updated", "accommodations", id, fields.internal_name);
    return { ok: true };
  });

export const setAccommodationActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase
      .from("accommodations")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(
      supabase,
      userId,
      data.active ? "accommodation.activated" : "accommodation.deactivated",
      "accommodations",
      data.id,
      null,
    );
    return { ok: true };
  });

export const deleteAccommodation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("accommodations").delete().eq("id", data.id);
    if (error) fail("This accommodation could not be deleted.");
    await audit(supabase, userId, "accommodation.deleted", "accommodations", data.id, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Rooms / camping options                                            */
/* ------------------------------------------------------------------ */

const roomInput = z.object({
  accommodation_id: z.string().uuid(),
  internal_name: z.string().min(1, "A room name is required.").max(200),
  public_name: nullableText(200),
  internal_reference: nullableText(60),
  description: nullableText(4000),
  internal_notes: nullableText(4000),
  max_guests: z.number().int().min(0, "Maximum guests cannot be negative.").max(1000),
  supplier_cost_per_night_idr: z.number().int().min(0, "The supplier cost cannot be negative."),
  customer_price_per_night_idr: z.number().int().min(0, "The customer price cannot be negative."),
  active: z.boolean(),
  characteristics: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        value: z.string().max(400).optional().nullable(),
      }),
    )
    .max(60)
    .optional(),
});

async function assertAccommodationExists(supabase: any, accommodationId: string) {
  const { data, error } = await supabase
    .from("accommodations")
    .select("id")
    .eq("id", accommodationId)
    .maybeSingle();
  if (error) fail(SAFE_ERROR);
  if (!data) fail("That accommodation does not exist.");
}

async function replaceCharacteristics(
  supabase: any,
  roomId: string,
  characteristics: { name: string; value?: string | null }[],
) {
  const { error: delError } = await supabase
    .from("accommodation_room_characteristics")
    .delete()
    .eq("room_id", roomId);
  if (delError) fail(SAFE_ERROR);
  const rows = characteristics
    .filter((c) => c.name.trim() !== "")
    .map((c, index) => ({
      room_id: roomId,
      name: c.name.trim(),
      value: c.value == null || c.value.trim() === "" ? null : c.value.trim(),
      sort_order: index,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("accommodation_room_characteristics").insert(rows);
  if (error) fail(SAFE_ERROR);
}

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => roomInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    await assertAccommodationExists(supabase, data.accommodation_id);

    const issues = validateRoom(data);
    if (issues.length > 0) fail(issues[0]!);

    const { characteristics, ...fields } = data;
    const { count } = await supabase
      .from("accommodation_rooms")
      .select("id", { count: "exact", head: true })
      .eq("accommodation_id", data.accommodation_id);

    const { data: row, error } = await supabase
      .from("accommodation_rooms")
      .insert({ ...fields, internal_name: fields.internal_name.trim(), sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);

    if (characteristics) await replaceCharacteristics(supabase, row.id, characteristics);

    await audit(supabase, userId, "room.created", "accommodation_rooms", row.id, fields.internal_name, {
      accommodation_id: data.accommodation_id,
      supplier_cost_per_night_idr: fields.supplier_cost_per_night_idr,
      customer_price_per_night_idr: fields.customer_price_per_night_idr,
    });
    return { id: row.id as string };
  });

export const updateRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => roomInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const issues = validateRoom(data);
    if (issues.length > 0) fail(issues[0]!);

    const { id, characteristics, ...fields } = data;
    const { data: before, error: beforeError } = await supabase
      .from("accommodation_rooms")
      .select("accommodation_id, supplier_cost_per_night_idr, customer_price_per_night_idr")
      .eq("id", id)
      .maybeSingle();
    if (beforeError) fail(SAFE_ERROR);
    if (!before) fail("That room does not exist.");
    if (before.accommodation_id !== fields.accommodation_id) {
      fail("A room cannot be moved to another accommodation.");
    }

    const { error } = await supabase
      .from("accommodation_rooms")
      .update({ ...fields, internal_name: fields.internal_name.trim() })
      .eq("id", id);
    if (error) fail(SAFE_ERROR);

    if (characteristics) await replaceCharacteristics(supabase, id, characteristics);

    await audit(supabase, userId, "room.updated", "accommodation_rooms", id, fields.internal_name);
    if (before.supplier_cost_per_night_idr !== fields.supplier_cost_per_night_idr) {
      await audit(supabase, userId, "room.supplier_cost_changed", "accommodation_rooms", id, null, {
        from: before.supplier_cost_per_night_idr,
        to: fields.supplier_cost_per_night_idr,
      });
    }
    if (before.customer_price_per_night_idr !== fields.customer_price_per_night_idr) {
      await audit(supabase, userId, "room.customer_price_changed", "accommodation_rooms", id, null, {
        from: before.customer_price_per_night_idr,
        to: fields.customer_price_per_night_idr,
      });
    }
    return { ok: true };
  });

export const setRoomActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase
      .from("accommodation_rooms")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(
      supabase,
      userId,
      data.active ? "room.activated" : "room.deactivated",
      "accommodation_rooms",
      data.id,
      null,
    );
    return { ok: true };
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("accommodation_rooms").delete().eq("id", data.id);
    if (error) fail("This room could not be deleted.");
    await audit(supabase, userId, "room.deleted", "accommodation_rooms", data.id, null);
    return { ok: true };
  });

/** Atomic, independent copy of one room including characteristics and photos. */
export const duplicateRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: newId, error } = await supabase.rpc("duplicate_accommodation_room", {
      _source: data.id,
    });
    if (error || !newId) fail("This room could not be duplicated.");
    await audit(supabase, userId, "room.duplicated", "accommodation_rooms", newId, null, {
      source_room_id: data.id,
    });
    return { id: newId as string };
  });

export const reorderRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ accommodation_id: z.string().uuid(), orderedIds: z.array(z.string().uuid()).max(200) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    for (const [index, id] of data.orderedIds.entries()) {
      const { error } = await supabase
        .from("accommodation_rooms")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("accommodation_id", data.accommodation_id);
      if (error) fail(SAFE_ERROR);
    }
    await audit(supabase, userId, "room.reordered", "accommodations", data.accommodation_id, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Photos                                                             */
/* ------------------------------------------------------------------ */

export const addPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        accommodation_id: z.string().uuid().nullable().optional(),
        room_id: z.string().uuid().nullable().optional(),
        storage_path: z.string().min(1).max(500),
        alt_text: nullableText(300),
      })
      .refine((v) => (v.accommodation_id ? !v.room_id : !!v.room_id), {
        message: "A photo belongs either to an accommodation or to a room.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const owner = data.accommodation_id
      ? { column: "accommodation_id", value: data.accommodation_id }
      : { column: "room_id", value: data.room_id as string };

    const { data: existing, error: listError } = await supabase
      .from("accommodation_photos")
      .select("id")
      .eq(owner.column, owner.value);
    if (listError) fail(SAFE_ERROR);

    const { data: row, error } = await supabase
      .from("accommodation_photos")
      .insert({
        accommodation_id: data.accommodation_id ?? null,
        room_id: data.room_id ?? null,
        storage_path: data.storage_path,
        alt_text: data.alt_text ?? null,
        sort_order: existing?.length ?? 0,
        is_primary: (existing?.length ?? 0) === 0,
      })
      .select("id")
      .single();
    if (error || !row) fail(SAFE_ERROR);
    await audit(supabase, userId, "photo.added", "accommodation_photos", row.id, null, {
      [owner.column]: owner.value,
    });
    return { id: row.id as string };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: photo } = await supabase
      .from("accommodation_photos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("accommodation_photos").delete().eq("id", data.id);
    if (error) fail("This photo could not be removed.");
    if (photo?.storage_path) {
      await supabase.storage.from("accommodation-photos").remove([photo.storage_path]);
    }
    await audit(supabase, userId, "photo.deleted", "accommodation_photos", data.id, null);
    return { ok: true };
  });

export const setPrimaryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: photo, error: readError } = await supabase
      .from("accommodation_photos")
      .select("accommodation_id, room_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !photo) fail(SAFE_ERROR);
    const column = photo.accommodation_id ? "accommodation_id" : "room_id";
    const value = photo.accommodation_id ?? photo.room_id;

    const { error: clearError } = await supabase
      .from("accommodation_photos")
      .update({ is_primary: false })
      .eq(column, value);
    if (clearError) fail(SAFE_ERROR);
    const { error } = await supabase
      .from("accommodation_photos")
      .update({ is_primary: true })
      .eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "photo.primary_set", "accommodation_photos", data.id, null);
    return { ok: true };
  });

export const reorderPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    await assertAdmin(supabase);
    for (const [index, id] of data.orderedIds.entries()) {
      const { error } = await supabase
        .from("accommodation_photos")
        .update({ sort_order: index })
        .eq("id", id);
      if (error) fail(SAFE_ERROR);
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Catalogue read for future configurators                            */
/* ------------------------------------------------------------------ */

/**
 * Customer-facing catalogue shape only: no supplier cost, no internal notes.
 * Future configurators consume this; nothing here is public yet.
 */
export const getSelectableAccommodation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ accommodation_type: z.enum(ACCOMMODATION_TYPES).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    let query = supabase
      .from("accommodations")
      .select(
        "id, accommodation_type, public_name, internal_name, description, location, active, sort_order, " +
          "accommodation_rooms(id, public_name, internal_name, description, max_guests, customer_price_per_night_idr, active, sort_order, " +
          "accommodation_room_characteristics(name, value, sort_order), " +
          "accommodation_photos(storage_path, alt_text, is_primary, sort_order)), " +
          "accommodation_photos(storage_path, alt_text, is_primary, sort_order)",
      )
      .eq("active", true)
      .order("sort_order");
    if (data.accommodation_type) query = query.eq("accommodation_type", data.accommodation_type);

    const { data: rows, error } = await query;
    if (error) fail(SAFE_ERROR);

    return (rows ?? []).map((a: any) => ({
      id: a.id,
      accommodation_type: a.accommodation_type,
      name: a.public_name ?? a.internal_name,
      description: a.description,
      location: a.location,
      photos: (a.accommodation_photos ?? []).sort((x: any, y: any) => x.sort_order - y.sort_order),
      rooms: (a.accommodation_rooms ?? [])
        .filter((r: any) => isRoomSelectable(a, r))
        .sort((x: any, y: any) => x.sort_order - y.sort_order)
        .map((r: any) => ({
          id: r.id,
          name: r.public_name ?? r.internal_name,
          description: r.description,
          max_guests: r.max_guests,
          customer_price_per_night_idr: r.customer_price_per_night_idr,
          characteristics: (r.accommodation_room_characteristics ?? []).sort(
            (x: any, y: any) => x.sort_order - y.sort_order,
          ),
          photos: (r.accommodation_photos ?? []).sort((x: any, y: any) => x.sort_order - y.sort_order),
        })),
    }));
  });

/**
 * Generic Catalogue Bridge — server-only resolver.
 *
 * One small function per catalogue template, all returning the same
 * `CatalogueItem` contract. Only active items of an ACTIVE catalogue are
 * returned, and only customer-safe fields: supplier costs, internal notes and
 * supplier contacts are never selected here.
 *
 * A field either names one catalogue (`catalogue_id`) or, for older fields,
 * only a template — in which case every active catalogue of that template is
 * used, exactly as before catalogues became manageable.
 *
 * This resolver exposes catalogue data. It never prices a product.
 */
import { PHOTO_BUCKET } from "@/lib/accommodation";
import { MOTORBIKE_PHOTO_BUCKET } from "@/lib/motorbike";
import {
  catalogueKey,
  DEFAULT_HOURS_LABEL,
  DEFAULT_PEOPLE_LABEL,
  type CatalogueItem,
  type CatalogueItemsByKey,
  type CatalogueRef,
  type CatalogueType,
  toCatalogueItem,
} from "@/lib/catalogue-bridge";

import { CATALOGUE_TEMPLATE_OF_TYPE } from "@/lib/catalogues";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const SIGNED_URL_SECONDS = 60 * 60;

async function signed(db: any, bucket: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Catalogue ids this reference may read from. An inactive catalogue, or one of
 * the wrong template, resolves to nothing at all.
 */
async function allowedCatalogueIds(db: any, ref: CatalogueRef): Promise<string[]> {
  const { data } = await db
    .from("catalogues")
    .select("id, template, active")
    .eq("template", CATALOGUE_TEMPLATE_OF_TYPE[ref.catalogue_type])
    .eq("active", true);
  const ids = (data ?? []).map((c: any) => c.id as string);
  if (!ref.catalogue_id) return ids;
  return ids.includes(ref.catalogue_id) ? [ref.catalogue_id] : [];
}

async function accommodationRooms(db: any, catalogueIds: string[]): Promise<CatalogueItem[]> {
  const [rooms, parents, photos] = await Promise.all([
    db
      .from("accommodation_rooms")
      .select(
        "id, accommodation_id, internal_name, public_name, internal_reference, description, customer_price_per_night_idr, active",
      )
      .eq("active", true)
      .order("sort_order"),
    db.from("accommodations").select("id, active, catalogue_id").in("catalogue_id", catalogueIds),
    db.from("accommodation_photos").select("room_id, storage_path, is_primary, sort_order").order("sort_order"),
  ]);

  const activeParents = new Map<string, string>();
  for (const a of parents.data ?? []) {
    if (a.active) activeParents.set(a.id, a.catalogue_id);
  }

  const items: CatalogueItem[] = [];
  for (const room of rooms.data ?? []) {
    // A room is only offerable while its accommodation is active too.
    if (!activeParents.has(room.accommodation_id)) continue;
    const photo =
      (photos.data ?? []).find((p: any) => p.room_id === room.id && p.is_primary) ??
      (photos.data ?? []).find((p: any) => p.room_id === room.id);
    items.push(
      toCatalogueItem("accommodation_room", {
        id: room.id,
        catalogue_id: activeParents.get(room.accommodation_id) ?? null,
        name: room.public_name || room.internal_name,
        reference: room.internal_reference,
        description: room.description,
        photo_url: await signed(db, PHOTO_BUCKET, photo?.storage_path ?? null),
        customer_price_idr: room.customer_price_per_night_idr,
      }),
    );
  }
  return items;
}

async function transports(db: any, catalogueIds: string[]): Promise<CatalogueItem[]> {
  const [rows, peoplePrices, timePrices, catalogueRows] = await Promise.all([
    db
      .from("transports")
      .select(
        "id, internal_name, public_name, internal_reference, description, active, catalogue_id, min_travel_hours, max_travel_hours, calc_mode",
      )
      .eq("active", true)
      .in("catalogue_id", catalogueIds)
      .order("sort_order"),
    db.from("transport_people_prices").select("transport_id, people, customer_price_idr").order("people"),
    db
      .from("transport_time_prices")
      .select("transport_id, travel_hours, customer_price_idr")
      .order("travel_hours"),
    db.from("catalogues").select("id, people_label, hours_label").in("id", catalogueIds),
  ]);

  const labels = new Map<string, { people: string; hours: string }>();
  for (const c of catalogueRows.data ?? []) {
    labels.set(c.id, {
      people: c.people_label?.trim() || DEFAULT_PEOPLE_LABEL,
      hours: c.hours_label?.trim() || DEFAULT_HOURS_LABEL,
    });
  }

  return (rows.data ?? []).map((t: any) => {
    // Transport is priced by number of people plus travel time. Both choices
    // travel with the item so the customer can answer them, and the pricing
    // engine receives the resulting amount as usual.
    const label = labels.get(t.catalogue_id) ?? {
      people: DEFAULT_PEOPLE_LABEL,
      hours: DEFAULT_HOURS_LABEL,
    };
    const people = (peoplePrices.data ?? [])
      .filter((p: any) => p.transport_id === t.id)
      .map((p: any) => ({ value: Number(p.people), price_idr: Number(p.customer_price_idr) }));
    const hours = (timePrices.data ?? [])
      .filter((p: any) => p.transport_id === t.id)
      .filter(
        (p: any) =>
          (t.min_travel_hours == null || p.travel_hours >= t.min_travel_hours) &&
          (t.max_travel_hours == null || p.travel_hours <= t.max_travel_hours),
      )
      .map((p: any) => ({ value: Number(p.travel_hours), price_idr: Number(p.customer_price_idr) }));

    const hasChoices = people.length > 0 || hours.length > 0;
    return toCatalogueItem("transport", {
      id: t.id,
      catalogue_id: t.catalogue_id,
      name: t.public_name || t.internal_name,
      reference: t.internal_reference,
      description: t.description,
      photo_url: null,
      customer_price_idr: null,
      variants: hasChoices
        ? {
            people_label: label.people,
            hours_label: label.hours,
            people,
            hours,
            calc_mode: t.calc_mode === "multiply" ? "multiply" : "sum",
          }
        : null,
    });
  });
}


async function motorbikes(db: any, catalogueIds: string[]): Promise<CatalogueItem[]> {
  const { data } = await db
    .from("motorbikes")
    .select(
      "id, internal_name, public_name, internal_reference, description, photo_path, customer_price_idr, active, catalogue_id",
    )
    .eq("active", true)
    .in("catalogue_id", catalogueIds)
    .order("sort_order");

  const items: CatalogueItem[] = [];
  for (const m of data ?? []) {
    items.push(
      toCatalogueItem("motorbike", {
        id: m.id,
        catalogue_id: m.catalogue_id,
        name: m.public_name || m.internal_name,
        reference: m.internal_reference,
        description: m.description,
        photo_url: await signed(db, MOTORBIKE_PHOTO_BUCKET, m.photo_path ?? null),
        customer_price_idr: m.customer_price_idr,
      }),
    );
  }
  return items;
}

/** Accepts a template name (legacy) or a full catalogue reference. */
function asRef(input: CatalogueType | CatalogueRef): CatalogueRef {
  return typeof input === "string" ? { catalogue_type: input, catalogue_id: null } : input;
}

/** One catalogue reference → its active, customer-safe items. */
export async function resolveCatalogue(
  input: CatalogueType | CatalogueRef,
): Promise<CatalogueItem[]> {
  const ref = asRef(input);
  const db = await admin();
  const ids = await allowedCatalogueIds(db, ref);
  if (ids.length === 0) return [];
  switch (ref.catalogue_type) {
    case "accommodation_room":
      return accommodationRooms(db, ids);
    case "transport":
      return transports(db, ids);
    case "motorbike":
      return motorbikes(db, ids);
    default:
      return [];
  }
}

/** Resolves every catalogue a product's fields read from, once each. */
export async function resolveCatalogues(
  refs: (CatalogueType | CatalogueRef)[],
): Promise<CatalogueItemsByKey> {
  const out: CatalogueItemsByKey = {};
  for (const input of refs) {
    const ref = asRef(input);
    const key = catalogueKey(ref);
    if (out[key]) continue;
    out[key] = await resolveCatalogue(ref);
  }
  return out;
}

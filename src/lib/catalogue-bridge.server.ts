/**
 * Generic Catalogue Bridge — server-only resolver.
 *
 * One small function per existing catalogue, all returning the same
 * `CatalogueItem` contract. Only active items are returned, and only
 * customer-safe fields: supplier costs, internal notes and supplier contacts
 * are never selected here.
 *
 * This resolver exposes catalogue data. It never prices a product.
 */
import { PHOTO_BUCKET } from "@/lib/accommodation";
import { MOTORBIKE_PHOTO_BUCKET } from "@/lib/motorbike";
import {
  type CatalogueItem,
  type CatalogueType,
  toCatalogueItem,
} from "@/lib/catalogue-bridge";

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

async function accommodationRooms(db: any): Promise<CatalogueItem[]> {
  const [rooms, parents, photos] = await Promise.all([
    db
      .from("accommodation_rooms")
      .select(
        "id, accommodation_id, internal_name, public_name, internal_reference, description, customer_price_per_night_idr, active",
      )
      .eq("active", true)
      .order("sort_order"),
    db.from("accommodations").select("id, active"),
    db.from("accommodation_photos").select("room_id, storage_path, is_primary, sort_order").order("sort_order"),
  ]);

  const activeParents = new Set(
    (parents.data ?? []).filter((a: any) => a.active).map((a: any) => a.id),
  );

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

async function transports(db: any): Promise<CatalogueItem[]> {
  const [rows, peoplePrices] = await Promise.all([
    db
      .from("transports")
      .select("id, internal_name, public_name, internal_reference, description, active")
      .eq("active", true)
      .order("sort_order"),
    db.from("transport_people_prices").select("transport_id, customer_price_idr"),
  ]);

  return (rows.data ?? []).map((t: any) => {
    // Transport prices depend on people/hours. Only a single unambiguous
    // configured customer price is exposed; anything else stays null and is
    // decided by the pricing engine, not by the bridge.
    const prices = (peoplePrices.data ?? []).filter((p: any) => p.transport_id === t.id);
    return toCatalogueItem("transport", {
      id: t.id,
      name: t.public_name || t.internal_name,
      reference: t.internal_reference,
      description: t.description,
      photo_url: null,
      customer_price_idr: prices.length === 1 ? prices[0].customer_price_idr : null,
    });
  });
}

async function motorbikes(db: any): Promise<CatalogueItem[]> {
  const { data } = await db
    .from("motorbikes")
    .select("id, internal_name, public_name, internal_reference, description, photo_path, customer_price_idr, active")
    .eq("active", true)
    .order("sort_order");

  const items: CatalogueItem[] = [];
  for (const m of data ?? []) {
    items.push(
      toCatalogueItem("motorbike", {
        id: m.id,
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

/** One catalogue type → its active, customer-safe items. */
export async function resolveCatalogue(type: CatalogueType): Promise<CatalogueItem[]> {
  const db = await admin();
  switch (type) {
    case "accommodation_room":
      return accommodationRooms(db);
    case "transport":
      return transports(db);
    case "motorbike":
      return motorbikes(db);
    default:
      return [];
  }
}

/** Resolves every catalogue type used by a product's fields, once each. */
export async function resolveCatalogues(
  types: CatalogueType[],
): Promise<Partial<Record<CatalogueType, CatalogueItem[]>>> {
  const unique = Array.from(new Set(types));
  const out: Partial<Record<CatalogueType, CatalogueItem[]>> = {};
  for (const type of unique) out[type] = await resolveCatalogue(type);
  return out;
}

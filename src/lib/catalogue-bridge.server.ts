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
    db.from("accommodations").select("id, active, catalogue_id"),
    db.from("accommodation_photos").select("room_id, storage_path, is_primary, sort_order").order("sort_order"),
  ]);

  const parentById = new Map<string, any>((parents.data ?? []).map((a: any) => [a.id, a]));

  const items: CatalogueItem[] = [];
  for (const room of rooms.data ?? []) {
    // A room is only offerable while its accommodation is active too.
    const parent = parentById.get(room.accommodation_id);
    if (!parent?.active) continue;
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
        catalogue_id: parent.catalogue_id ?? null,
      }),
    );
  }
  return items;
}

async function transports(db: any): Promise<CatalogueItem[]> {
  const [rows, peoplePrices] = await Promise.all([
    db
      .from("transports")
      .select(
        "id, internal_name, public_name, internal_reference, description, active, catalogue_id",
      )
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
      catalogue_id: t.catalogue_id ?? null,
    });
  });
}

async function motorbikes(db: any): Promise<CatalogueItem[]> {
  const { data } = await db
    .from("motorbikes")
    .select("id, internal_name, public_name, internal_reference, description, photo_path, customer_price_idr, active, catalogue_id")
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
        catalogue_id: m.catalogue_id ?? null,
      }),
    );
  }
  return items;
}


/** Items whose catalogue instance has been switched off are not offerable. */
async function dropInactiveCatalogues(db: any, items: CatalogueItem[]): Promise<CatalogueItem[]> {
  if (items.every((i) => i.catalogue_id == null)) return items;
  const { data } = await db.from("catalogues").select("id, active");
  const inactive = new Set(
    (data ?? []).filter((c: any) => !c.active).map((c: any) => c.id as string),
  );
  if (inactive.size === 0) return items;
  return items.filter((i) => i.catalogue_id == null || !inactive.has(i.catalogue_id));
}

/** One catalogue type → its active, customer-safe items. */
export async function resolveCatalogue(type: CatalogueType): Promise<CatalogueItem[]> {
  const db = await admin();
  let items: CatalogueItem[] = [];
  switch (type) {
    case "accommodation_room":
      items = await accommodationRooms(db);
      break;
    case "transport":
      items = await transports(db);
      break;
    case "motorbike":
      items = await motorbikes(db);
      break;
    default:
      return [];
  }
  return dropInactiveCatalogues(db, items);
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

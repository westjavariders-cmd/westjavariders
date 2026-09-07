/**
 * Accommodation catalogue: pure helpers shared by the Admin UI and the
 * server functions. No pricing engine lives here — room prices are plain
 * reference amounts in whole Rupiah, exactly as stored.
 */

export const ACCOMMODATION_TYPES = ["hotel", "beach_camping"] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

export const ACCOMMODATION_TYPE_LABELS: Record<AccommodationType, string> = {
  hotel: "Hotel / Accommodation",
  beach_camping: "Beach Camping",
};

export type Accommodation = {
  id: string;
  accommodation_type: AccommodationType;
  internal_name: string;
  public_name: string | null;
  internal_reference: string | null;
  description: string | null;
  location: string | null;
  supplier_contact: string | null;
  active: boolean;
  internal_notes: string | null;
  sort_order: number;
};

export type AccommodationRoom = {
  id: string;
  accommodation_id: string;
  internal_name: string;
  public_name: string | null;
  internal_reference: string | null;
  description: string | null;
  max_guests: number;
  supplier_cost_per_night_idr: number;
  customer_price_per_night_idr: number;
  active: boolean;
  internal_notes: string | null;
  sort_order: number;
};

export type RoomCharacteristic = {
  id: string;
  room_id: string;
  name: string;
  value: string | null;
  sort_order: number;
};

export type AccommodationPhoto = {
  id: string;
  accommodation_id: string | null;
  room_id: string | null;
  storage_path: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
};

export const PHOTO_BUCKET = "accommodation-photos";

/** Informational margin only. Never used to derive the customer price. */
export function roomMargin(supplierCostIdr: number, customerPriceIdr: number) {
  const amount = customerPriceIdr - supplierCostIdr;
  const percentage = customerPriceIdr === 0 ? 0 : (amount / customerPriceIdr) * 100;
  return { amount, percentage };
}

export function formatIdr(amount: number) {
  return `Rp ${Math.round(amount).toLocaleString("en-US")}`;
}

/** Whole Rupiah only: no floating point money anywhere in the catalogue. */
export function parseIdr(input: string): number | null {
  const cleaned = input.replace(/[\s.,]/g, "");
  if (cleaned === "") return 0;
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function validateAccommodation(input: {
  internal_name: string;
  accommodation_type: string;
}): string[] {
  const issues: string[] = [];
  if (input.internal_name.trim() === "") issues.push("An internal name is required.");
  if (!ACCOMMODATION_TYPES.includes(input.accommodation_type as AccommodationType)) {
    issues.push("The accommodation type is not valid.");
  }
  return issues;
}

export function validateRoom(input: {
  internal_name: string;
  max_guests: number;
  supplier_cost_per_night_idr: number;
  customer_price_per_night_idr: number;
}): string[] {
  const issues: string[] = [];
  if (input.internal_name.trim() === "") issues.push("A room name is required.");
  if (!Number.isInteger(input.max_guests) || input.max_guests < 0) {
    issues.push("Maximum guests cannot be negative.");
  }
  if (!Number.isInteger(input.supplier_cost_per_night_idr) || input.supplier_cost_per_night_idr < 0) {
    issues.push("The supplier cost cannot be negative.");
  }
  if (!Number.isInteger(input.customer_price_per_night_idr) || input.customer_price_per_night_idr < 0) {
    issues.push("The customer price cannot be negative.");
  }
  return issues;
}

/**
 * Commercial selectability for future configurators: an inactive parent
 * accommodation always blocks its rooms, even when the room says active.
 */
export function isRoomSelectable(accommodation: { active: boolean }, room: { active: boolean }) {
  return accommodation.active && room.active;
}

/** Camping and per-night rooms alike: price per night x nights. */
export function nightsSubtotalIdr(pricePerNightIdr: number, nights: number) {
  if (!Number.isInteger(nights) || nights < 0) return null;
  return pricePerNightIdr * nights;
}

/** Ordering helper used by the reorder controls. */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}

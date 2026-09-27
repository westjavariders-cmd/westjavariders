/**
 * Cart booking-conditions copy. The checkbox sentence is fixed; the popup
 * body is Admin-owned plain text. This never prices or pays anything.
 */

export const BOOKING_CONDITIONS_SETTING_KEY = "booking_conditions_body";
export const BOOKING_CONDITIONS_MAX_CHARS = 20000;

export const CART_CONDITIONS_ACCEPTANCE_LABEL =
  "I've read, understood and accepted the conditions, knowing that surfing always comes with its own risks.";

export function sanitizeBookingConditions(raw: string | null | undefined): string {
  const text = (raw ?? "").replace(/\0/g, "");
  if (text.length <= BOOKING_CONDITIONS_MAX_CHARS) return text;
  return text.slice(0, BOOKING_CONDITIONS_MAX_CHARS);
}

export function bookingConditionsAreEmpty(raw: string | null | undefined): boolean {
  return sanitizeBookingConditions(raw).trim() === "";
}

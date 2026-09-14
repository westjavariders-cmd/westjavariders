/**
 * Direct catalogue booking — pure layer.
 *
 * A "Book individually" line prices one active catalogue item directly, with
 * no product and no configurator. Each template has its own minimal question
 * set, exactly mirroring how the catalogue defines customer prices:
 *
 * - accommodation_room: number of nights  (price per night × nights)
 * - motorbike:          number of days    (price per day × days)
 * - transport:          people + hours choices (catalogueItemPriceIdr,
 *                       honouring the item's sum/multiply mode)
 *
 * Nothing here reads the database; the server layer resolves the item first
 * and every price is recomputed from the live catalogue on each quote.
 */
import {
  catalogueItemPriceIdr,
  type CatalogueItem,
  type CatalogueType,
} from "@/lib/catalogue-bridge";

/** Customer choices for one direct booking, per template. */
export type DirectBookingChoices = {
  nights?: number | null;
  days?: number | null;
  people?: number | null;
  hours?: number | null;
};

export type DirectPriceResult = {
  /** Price in whole IDR, or null when the choices cannot price the item. */
  total_idr: number | null;
  /** Human-readable summary lines of what is being booked. */
  summary: { label: string; value: string }[];
  /** Plain-language reasons the booking cannot be priced yet. */
  issues: string[];
};

function positiveInt(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

/** Which quantity question a template asks, if any. */
export function directQuantityLabel(type: CatalogueType): string | null {
  if (type === "accommodation_room") return "Nights";
  if (type === "motorbike") return "Days";
  return null;
}

/**
 * Prices one direct booking from an already-resolved catalogue item.
 * The same function runs at display time ("from" price), at cart time and
 * again inside checkout revalidation — the stored number is never trusted.
 */
export function priceDirectBooking(
  item: CatalogueItem,
  choices: DirectBookingChoices,
): DirectPriceResult {
  const summary: { label: string; value: string }[] = [];
  const issues: string[] = [];

  if (item.catalogue_type === "accommodation_room") {
    const nights = positiveInt(choices.nights);
    if (item.customer_price_idr == null) {
      issues.push("This item has no price yet.");
      return { total_idr: null, summary, issues };
    }
    if (nights == null) {
      issues.push("Choose how many nights you want to stay.");
      return { total_idr: null, summary, issues };
    }
    summary.push({ label: "Nights", value: String(nights) });
    return { total_idr: item.customer_price_idr * nights, summary, issues };
  }

  if (item.catalogue_type === "motorbike") {
    const days = positiveInt(choices.days);
    if (item.customer_price_idr == null) {
      issues.push("This item has no price yet.");
      return { total_idr: null, summary, issues };
    }
    if (days == null) {
      issues.push("Choose for how many days you want it.");
      return { total_idr: null, summary, issues };
    }
    summary.push({ label: "Days", value: String(days) });
    return { total_idr: item.customer_price_idr * days, summary, issues };
  }

  if (item.catalogue_type === "transport") {
    const people = positiveInt(choices.people);
    const hours = positiveInt(choices.hours);
    const price = catalogueItemPriceIdr(item, people, hours);
    if (item.variants) {
      if (item.variants.people.length > 0) {
        summary.push({
          label: item.variants.people_label,
          value: people == null ? "—" : String(people),
        });
      }
      if (item.variants.hours.length > 0) {
        summary.push({
          label: item.variants.hours_label,
          value: hours == null ? "—" : String(hours),
        });
      }
      if (price == null) {
        const missing = [
          item.variants.people.length > 0 && people == null ? item.variants.people_label : null,
          item.variants.hours.length > 0 && hours == null ? item.variants.hours_label : null,
        ].filter(Boolean);
        issues.push(
          missing.length > 0
            ? `Please choose ${missing.join(" and ")}.`
            : "This combination is not available.",
        );
      }
    } else if (item.customer_price_idr == null) {
      issues.push("This item has no price yet.");
    }
    return { total_idr: price, summary, issues };
  }

  issues.push("This item cannot be booked directly.");
  return { total_idr: null, summary, issues };
}

/** The cheapest bookable price of an item, for "from" display. */
export function directFromPriceIdr(item: CatalogueItem): number | null {
  if (item.catalogue_type === "accommodation_room" || item.catalogue_type === "motorbike") {
    return item.customer_price_idr;
  }
  if (item.catalogue_type === "transport") {
    const v = item.variants;
    if (!v) return item.customer_price_idr;
    const minPeople = v.people.length > 0 ? Math.min(...v.people.map((p) => p.price_idr)) : 0;
    const minHours = v.hours.length > 0 ? Math.min(...v.hours.map((h) => h.price_idr)) : 0;
    if (v.calc_mode === "multiply" && v.people.length > 0 && v.hours.length > 0) {
      return minPeople * minHours;
    }
    return minPeople + minHours;
  }
  return item.customer_price_idr;
}

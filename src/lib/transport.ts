/**
 * Transport catalogue: pure helpers shared by the Admin UI and the server
 * functions. Money is whole Rupiah only, exactly as stored. Nothing here is
 * wired into the Product Pricing Engine.
 */

export const TRANSPORT_TYPES = ["predefined_route", "other_location"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  predefined_route: "Predefined route",
  other_location: "Other location",
};

export const PEOPLE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const TRAVEL_HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export const MAX_TRANSPORT_PEOPLE = 7;
export const MAX_TRAVEL_HOURS = 14;

export type Transport = {
  id: string;
  transport_type: TransportType;
  internal_name: string;
  public_name: string | null;
  internal_reference: string | null;
  description: string | null;
  origin: string | null;
  destination: string | null;
  min_travel_hours: number | null;
  max_travel_hours: number | null;
  active: boolean;
  internal_notes: string | null;
  sort_order: number;
};

export type TransportPeoplePrice = {
  id: string;
  transport_id: string;
  people: number;
  supplier_cost_idr: number;
  customer_price_idr: number;
};

export type TransportTimePrice = {
  id: string;
  transport_id: string;
  travel_hours: number;
  supplier_cost_idr: number;
  customer_price_idr: number;
};

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

/** Informational margin only. Never used to derive the customer price. */
export function transportMargin(supplierCostIdr: number, customerPriceIdr: number) {
  const amount = customerPriceIdr - supplierCostIdr;
  const percentage = customerPriceIdr === 0 ? 0 : (amount / customerPriceIdr) * 100;
  return { amount, percentage };
}

export function isWholeNonNegative(value: number) {
  return Number.isInteger(value) && value >= 0;
}

export function validateTransport(input: {
  internal_name: string;
  transport_type: string;
  min_travel_hours?: number | null;
  max_travel_hours?: number | null;
}): string[] {
  const issues: string[] = [];
  if (input.internal_name.trim() === "") issues.push("An internal name is required.");
  if (!TRANSPORT_TYPES.includes(input.transport_type as TransportType)) {
    issues.push("The transport type is not valid.");
  }
  for (const [label, value] of [
    ["minimum", input.min_travel_hours],
    ["maximum", input.max_travel_hours],
  ] as const) {
    if (value == null) continue;
    if (!Number.isInteger(value) || value < 1 || value > MAX_TRAVEL_HOURS) {
      issues.push(`The ${label} travel time must be between 1 and ${MAX_TRAVEL_HOURS} hours.`);
    }
  }
  const min = input.min_travel_hours;
  const max = input.max_travel_hours;
  if (min != null && max != null && Number.isInteger(min) && Number.isInteger(max) && min > max) {
    issues.push("The minimum travel time cannot be greater than the maximum.");
  }
  return issues;
}

export function validatePeoplePrices(
  rows: { people: number; supplier_cost_idr: number; customer_price_idr: number }[],
): string[] {
  const issues: string[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.people) || row.people < 1 || row.people > MAX_TRANSPORT_PEOPLE) {
      issues.push(`The number of people must be between 1 and ${MAX_TRANSPORT_PEOPLE}.`);
    } else if (seen.has(row.people)) {
      issues.push(`There is more than one price for ${row.people} people.`);
    } else {
      seen.add(row.people);
    }
    if (!isWholeNonNegative(row.supplier_cost_idr)) {
      issues.push("Supplier costs must be whole Rupiah and cannot be negative.");
    }
    if (!isWholeNonNegative(row.customer_price_idr)) {
      issues.push("Customer prices must be whole Rupiah and cannot be negative.");
    }
  }
  return issues;
}

export function validateTimePrices(
  rows: { travel_hours: number; supplier_cost_idr: number; customer_price_idr: number }[],
): string[] {
  const issues: string[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.travel_hours) || row.travel_hours < 1 || row.travel_hours > MAX_TRAVEL_HOURS) {
      issues.push(`Travel time must be between 1 and ${MAX_TRAVEL_HOURS} hours.`);
    } else if (seen.has(row.travel_hours)) {
      issues.push(`There is more than one price for ${row.travel_hours} hours.`);
    } else {
      seen.add(row.travel_hours);
    }
    if (!isWholeNonNegative(row.supplier_cost_idr)) {
      issues.push("Supplier costs must be whole Rupiah and cannot be negative.");
    }
    if (!isWholeNonNegative(row.customer_price_idr)) {
      issues.push("Customer prices must be whole Rupiah and cannot be negative.");
    }
  }
  return issues;
}

/**
 * Admin-only calculator for "other location" transport:
 * customer price = time price + people price. Exact whole Rupiah.
 */
export function otherLocationQuote(input: {
  timePrice: { supplier_cost_idr: number; customer_price_idr: number } | undefined;
  peoplePrice: { supplier_cost_idr: number; customer_price_idr: number } | undefined;
}) {
  if (!input.timePrice || !input.peoplePrice) return null;
  const timeCustomerIdr = input.timePrice.customer_price_idr;
  const peopleCustomerIdr = input.peoplePrice.customer_price_idr;
  const finalPriceIdr = timeCustomerIdr + peopleCustomerIdr;
  const internalCostIdr = input.timePrice.supplier_cost_idr + input.peoplePrice.supplier_cost_idr;
  return {
    timeCustomerIdr,
    peopleCustomerIdr,
    finalPriceIdr,
    internalCostIdr,
    ...transportMargin(internalCostIdr, finalPriceIdr),
  };
}

/**
 * Additional Admin-only calculator mode for "other location" transport:
 * customer price = time price x people price (the price configured for the
 * selected number of people). Exact whole Rupiah.
 * The existing sum mode is unchanged; this is an extra option.
 */
export function otherLocationQuoteMultiplied(input: {
  timePrice: { supplier_cost_idr: number; customer_price_idr: number } | undefined;
  peoplePrice: { supplier_cost_idr: number; customer_price_idr: number } | undefined;
}) {
  if (!input.timePrice || !input.peoplePrice) return null;
  const timeCustomerIdr = input.timePrice.customer_price_idr;
  const peopleCustomerIdr = input.peoplePrice.customer_price_idr;
  const finalPriceIdr = timeCustomerIdr * peopleCustomerIdr;
  const internalCostIdr = input.timePrice.supplier_cost_idr * input.peoplePrice.supplier_cost_idr;
  return {
    timeCustomerIdr,
    peopleCustomerIdr,
    finalPriceIdr,
    internalCostIdr,
    ...transportMargin(internalCostIdr, finalPriceIdr),
  };
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

const OLD_MAX_TRANSPORT_PEOPLE = 4;
const OLD_MAX_TRAVEL_HOURS = 9;

/**
 * Public people/hours pickers follow the Admin grid, not only rows already
 * stored. A consecutive 1..oldMax table is opened out to the new max; other
 * sparse tables are left as stored. Missing slots keep price 0 until Admin saves.
 */
export function expandTransportPriceChoices(
  rows: { value: number; price_idr: number }[],
  oldFullMax: number,
  newMax: number,
): { value: number; price_idr: number }[] {
  if (rows.length === 0) return [];
  const byValue = new Map(rows.map((row) => [row.value, row.price_idr]));
  const values = [...byValue.keys()].sort((a, b) => a - b);
  const consecutiveFromOne = values.every((value, i) => value === i + 1);
  const currentMax = values[values.length - 1]!;
  if (!consecutiveFromOne || currentMax < oldFullMax) {
    return values.map((value) => ({ value, price_idr: byValue.get(value) ?? 0 }));
  }
  return Array.from({ length: newMax }, (_, i) => {
    const value = i + 1;
    return { value, price_idr: byValue.get(value) ?? 0 };
  });
}

export function publicTransportPeopleChoices(rows: { value: number; price_idr: number }[]) {
  return expandTransportPriceChoices(rows, OLD_MAX_TRANSPORT_PEOPLE, MAX_TRANSPORT_PEOPLE);
}

export function publicTransportHourChoices(
  rows: { value: number; price_idr: number }[],
  min: number | null,
  max: number | null,
) {
  const expanded = expandTransportPriceChoices(rows, OLD_MAX_TRAVEL_HOURS, MAX_TRAVEL_HOURS);
  // 9 was the previous catalogue ceiling; do not hide 10–14 on the customer picker.
  const cap = max === OLD_MAX_TRAVEL_HOURS ? MAX_TRAVEL_HOURS : max;
  return expanded.filter(
    (row) => (min == null || row.value >= min) && (cap == null || row.value <= cap),
  );
}

/**
 * Motorbike rental catalogue: pure helpers shared by the Admin UI and the
 * server functions. Money is whole Rupiah only, exactly as stored. Nothing
 * here is wired into the Product Pricing Engine.
 */

export const MOTORBIKE_PHOTO_BUCKET = "motorbike-photos";

export type Motorbike = {
  id: string;
  internal_name: string;
  public_name: string | null;
  internal_reference: string | null;
  description: string | null;
  photo_path: string | null;
  supplier_cost_idr: number;
  customer_price_idr: number;
  active: boolean;
  internal_notes: string | null;
  sort_order: number;
};

/** Informational margin only. Never used to derive the customer price. */
export function motorbikeMargin(supplierCostIdr: number, customerPriceIdr: number) {
  const amount = customerPriceIdr - supplierCostIdr;
  const percentage = customerPriceIdr === 0 ? 0 : (amount / customerPriceIdr) * 100;
  return { amount, percentage };
}

export function validateMotorbike(input: {
  internal_name: string;
  supplier_cost_idr: number;
  customer_price_idr: number;
}): string[] {
  const issues: string[] = [];
  if (input.internal_name.trim() === "") issues.push("An internal name is required.");
  for (const [label, value] of [
    ["Supplier costs", input.supplier_cost_idr],
    ["Customer prices", input.customer_price_idr],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      issues.push(`${label} must be whole Rupiah and cannot be negative.`);
    }
  }
  return issues;
}

/** Private, non-guessable object path for the optional main photo. */
export function motorbikePhotoPath(motorbikeId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-").slice(-80);
  return `${motorbikeId}/${crypto.randomUUID()}-${safe}`;
}

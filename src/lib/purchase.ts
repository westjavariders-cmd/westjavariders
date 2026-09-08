/**
 * Pure commercial rules for the Purchase core. No database, no provider.
 *
 * All money here is whole Rupiah (integers). The deposit percentage always
 * comes from the global settings; it is never hardcoded in this module.
 */

export const PURCHASE_STATUSES = ["pending_payment", "partially_paid", "paid", "cancelled"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PAYMENT_REQUEST_STATUSES = [
  "created",
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export const PAYMENT_REQUEST_KINDS = ["first_payment", "balance"] as const;
export type PaymentRequestKind = (typeof PAYMENT_REQUEST_KINDS)[number];

export class PurchaseError extends Error {}

export function purchaseFail(message: string): never {
  throw new PurchaseError(message);
}

/**
 * Reads the configured first-payment percentage. The value lives in global
 * settings (`first_payment_percentage`) and supports up to two decimals.
 */
export function parseFirstPaymentPercentage(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") purchaseFail("The first payment percentage is not configured.");
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    purchaseFail("The first payment percentage is not configured correctly.");
  }
  // Two decimals maximum, mirroring the numeric(5,2) column.
  return Math.round(value * 100) / 100;
}

/**
 * ROUNDING RULE (single, explicit, whole-Rupiah):
 * deposit = round-half-up(total x percentage / 100), clamped to [0, total].
 * The outstanding balance is always total - deposit, so the invariant
 * deposit + balance = total holds exactly for every possible input.
 */
export function depositFor(totalIdr: number, percentage: number): number {
  if (!Number.isInteger(totalIdr) || totalIdr < 0) {
    purchaseFail("The purchase total must be a whole, non-negative Rupiah amount.");
  }
  const scaledPct = BigInt(Math.round(percentage * 100)); // percentage x 100
  const total = BigInt(totalIdr);
  const deposit = (total * scaledPct + 5000n) / 10000n; // half-up on whole Rupiah
  const clamped = deposit < 0n ? 0n : deposit > total ? total : deposit;
  return Number(clamped);
}

export function balanceFor(totalIdr: number, depositIdr: number): number {
  return totalIdr - depositIdr;
}

/** Purchase financial status derived from confirmed money only. */
export function purchaseStatusFor(totalIdr: number, paidIdr: number): PurchaseStatus {
  if (paidIdr <= 0) return "pending_payment";
  if (paidIdr >= totalIdr) return "paid";
  return "partially_paid";
}

/** Provider-neutral mapping of a payment request lifecycle to money received. */
export function isSettled(status: PaymentRequestStatus): boolean {
  return status === "paid";
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending_payment: "Awaiting payment",
  partially_paid: "Partly paid",
  paid: "Paid in full",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentRequestStatus, string> = {
  created: "Created",
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};

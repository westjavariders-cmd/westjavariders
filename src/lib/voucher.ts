/**
 * Pure voucher rules. No database, no framework.
 *
 * A Voucher is a document/entitlement derived from the immutable Purchase
 * Snapshot. Nothing here prices, discounts or re-quotes anything: the
 * snapshot is the historical commercial source of truth.
 */

export const VOUCHER_TYPES = ["STANDARD", "GIFT"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

export const VOUCHER_STATUSES = ["ACTIVE", "USED", "EXPIRED", "CANCELLED"] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  STANDARD: "Standard",
  GIFT: "Gift",
};

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  ACTIVE: "Active",
  USED: "Used",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export class VoucherError extends Error {}

export function voucherFail(message: string): never {
  throw new VoucherError(message);
}

/** CBR-YYYY-NNN — the only accepted shape for a voucher number. */
export const VOUCHER_CODE_PATTERN = /^CBR-\d{4}-\d{3,}$/;

export function isVoucherCode(value: unknown): boolean {
  return typeof value === "string" && VOUCHER_CODE_PATTERN.test(value);
}

/* ------------------------------------------------------------------ */
/* Validity                                                            */
/* ------------------------------------------------------------------ */

/** Reads the global `voucher_validity_months` setting. Never hardcoded. */
export function parseValidityMonths(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") voucherFail("The voucher validity is not configured.");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 120) {
    voucherFail("The voucher validity is not configured correctly.");
  }
  return value;
}

/** Calendar-month addition, clamped to the end of a shorter month. */
export function addMonths(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const target = new Date(from.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function validUntil(issuedAt: Date, months: number): Date {
  return addMonths(issuedAt, months);
}

/* ------------------------------------------------------------------ */
/* Gift data                                                           */
/* ------------------------------------------------------------------ */

export const GIFT_MESSAGE_MAX = 200;

export type GiftInput = {
  is_gift?: unknown;
  gift_recipient_name?: unknown;
  gift_message?: unknown;
};

export type GiftData = {
  is_gift: boolean;
  gift_recipient_name: string | null;
  gift_message: string | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Validated server-side; a non-gift purchase never carries gift data. */
export function validateGift(input: GiftInput | undefined): GiftData {
  const is_gift = input?.is_gift === true;
  if (!is_gift) return { is_gift: false, gift_recipient_name: null, gift_message: null };

  const name = text(input?.gift_recipient_name).replace(/\s+/g, " ") || null;
  if (name && name.length > 120) voucherFail("Please enter a shorter recipient name.");

  const message = text(input?.gift_message) || null;
  if (message && message.length > GIFT_MESSAGE_MAX) {
    voucherFail(`Your message can be at most ${GIFT_MESSAGE_MAX} characters.`);
  }

  return { is_gift: true, gift_recipient_name: name, gift_message: message };
}

/* ------------------------------------------------------------------ */
/* Entitlement (customer-facing representation)                        */
/* ------------------------------------------------------------------ */

export type VoucherEntitlementItem = {
  product_title: string;
  /** Customer-facing option labels/values as answered at purchase time. */
  options: { label: string; value: string }[];
  people: number | null;
  quantity: number | null;
  /** Base amount of this package. Never present on a gift voucher. */
  base_price_idr: number | null;
  /** The partial amounts the price is made of. Empty on a gift voucher. */
  breakdown: { label: string; amount_idr: number }[];
  /** Final amount of this package. Never present on a gift voucher. */
  total_idr: number | null;
};


export type VoucherEntitlement = {
  representation_version: 1;
  built_at: string;
  voucher_type: VoucherType;
  purchase_reference: string | null;
  purchase_date: string | null;
  /** The specific purchased Package this voucher entitles. */
  package_id: string | null;
  package_title: string | null;
  /** Present for standard vouchers only; a gift never shows the price. */
  total_idr: number | null;
  payment_state: "partially_paid" | "fully_paid" | "awaiting_payment";
  customer_name: string | null;
  recipient_name: string | null;
  gift_message: string | null;
  items: VoucherEntitlementItem[];
  usage_instructions: string[];
  contact: { business: string; email: string; whatsapp: string; location: string };
};


export const CIMAJA_CONTACT = {
  business: "Cimaja Boardriders",
  email: "hello@cimajaboardriders.com",
  whatsapp: "+62 812 0000 0000",
  location: "Cimaja, West Java, Indonesia",
};

export const VOUCHER_INSTRUCTIONS = [
  "Show this voucher number when you arrive or when you contact us to book your dates.",
  "Your voucher has an open date: use it any time before the validity date shown above.",
  "Contact us in advance so we can reserve your spot, equipment and guide.",
];

function optionLabels(pkg: any): { label: string; value: string }[] {
  const answers = (pkg?.answers ?? {}) as Record<string, unknown>;
  const out: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;
    const label = key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    const value = Array.isArray(raw) ? raw.map(String).join(", ") : String(raw);
    out.push({ label, value });
  }
  return out;
}

function numberFrom(inputs: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = inputs?.[key];
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Builds the customer-safe entitlement from the immutable Purchase Snapshot.
 * One voucher entitles one purchased Package: when `packageId` is given, only
 * that package from the snapshot is represented.
 * Supplier costs, margins, internal notes and formulas are never included:
 * only the fields the snapshot exposes as customer-facing data are read.
 */
export function buildEntitlement(args: {
  snapshot: any;
  voucherType: VoucherType;
  purchaseReference: string | null;
  purchaseCreatedAt: string | null;
  packageId?: string | null;
  totalIdr: number;
  paidIdr: number;
  recipientName: string | null;
  giftMessage: string | null;
  now?: Date;
}): VoucherEntitlement {
  const snapshot = args.snapshot ?? {};
  const all: any[] = Array.isArray(snapshot.packages) ? snapshot.packages : [];
  const isGift = args.voucherType === "GIFT";

  const packages = args.packageId
    ? all.filter((p) => String(p?.package_id) === String(args.packageId))
    : all;
  const own = packages[0] ?? null;

  const packageTotal = Number(own?.total_idr);
  const priceIdr = Number.isFinite(packageTotal) && packageTotal > 0
    ? packageTotal
    : Number(args.totalIdr);

  const payment_state =
    args.paidIdr <= 0
      ? "awaiting_payment"
      : args.paidIdr >= args.totalIdr
        ? "fully_paid"
        : "partially_paid";

  return {
    representation_version: 1,
    built_at: (args.now ?? new Date()).toISOString(),
    voucher_type: args.voucherType,
    purchase_reference: args.purchaseReference,
    purchase_date: args.purchaseCreatedAt,
    package_id: args.packageId ?? own?.package_id ?? null,
    package_title: own?.product_title ?? null,
    total_idr: isGift ? null : priceIdr,
    payment_state,
    customer_name: snapshot.customer?.full_name ?? null,
    recipient_name: isGift ? args.recipientName : null,
    gift_message: isGift ? args.giftMessage : null,
    items: packages.map((p) => ({
      product_title: p.product_title ?? "Experience",
      options: optionLabels(p),
      people: numberFrom(p.resolved_inputs, ["people", "guests", "participants"]),
      quantity: numberFrom(p.resolved_inputs, ["quantity", "sessions", "days", "nights"]),
    })),
    usage_instructions: VOUCHER_INSTRUCTIONS,
    contact: CIMAJA_CONTACT,
  };
}


/* ------------------------------------------------------------------ */
/* Redemption                                                          */
/* ------------------------------------------------------------------ */

export type RedeemableVoucher = {
  id: string;
  code: string;
  purchase_id: string;
  status: VoucherStatus;
  valid_until: string;
};

/**
 * The single place that decides whether a voucher may be consumed.
 * Expiry is evaluated against the stored validity date, never recalculated
 * from current settings.
 */
export function redemptionCheck(
  voucher: RedeemableVoucher | null | undefined,
  options?: { expectedPurchaseId?: string; now?: Date },
): { ok: boolean; reason?: string; effectiveStatus?: VoucherStatus } {
  if (!voucher) return { ok: false, reason: "This voucher could not be found." };
  if (voucher.status === "CANCELLED")
    return { ok: false, reason: "This voucher has been cancelled.", effectiveStatus: "CANCELLED" };
  if (voucher.status === "USED")
    return { ok: false, reason: "This voucher has already been used.", effectiveStatus: "USED" };

  const now = options?.now ?? new Date();
  if (new Date(voucher.valid_until).getTime() < now.getTime()) {
    return { ok: false, reason: "This voucher has expired.", effectiveStatus: "EXPIRED" };
  }
  if (voucher.status === "EXPIRED")
    return { ok: false, reason: "This voucher has expired.", effectiveStatus: "EXPIRED" };

  if (options?.expectedPurchaseId && voucher.purchase_id !== options.expectedPurchaseId) {
    return { ok: false, reason: "This voucher does not belong to that booking." };
  }
  return { ok: true, effectiveStatus: "ACTIVE" };
}

/** Display status: an active voucher past its validity date reads as expired. */
export function effectiveStatus(
  status: VoucherStatus,
  validUntil: string,
  now: Date = new Date(),
): VoucherStatus {
  if (status === "ACTIVE" && new Date(validUntil).getTime() < now.getTime()) return "EXPIRED";
  return status;
}

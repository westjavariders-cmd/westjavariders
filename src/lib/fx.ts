/**
 * Currency & FX — pure layer.
 *
 * IDR is the single authoritative internal currency. A customer currency is a
 * presentation + payment-snapshot currency only.
 *
 * RATE CONVENTION: `rate` is how many whole Rupiah one unit of the customer
 * currency is worth (e.g. EUR 1 = 18,000 IDR). Rates are stored with six
 * decimals, so all arithmetic here is exact BigInt arithmetic on micro-units.
 * No binary floating-point money maths, ever.
 */

export const BASE_CURRENCY = "IDR" as const;

/** The fallback customer currency when no market or choice applies. */
export const FALLBACK_CURRENCY = "EUR" as const;

const SCALE = 1_000_000n; // six decimals, matching numeric(20,6)

export class FxError extends Error {}

export function fxFail(message: string): never {
  throw new FxError(message);
}

export function isBaseCurrency(code: string): boolean {
  return code.toUpperCase() === BASE_CURRENCY;
}

/** Parses an admin-entered rate into exact micro-units of Rupiah per unit. */
export function parseRateMicros(raw: string | number | null | undefined): bigint {
  if (raw == null || String(raw).trim() === "") fxFail("Enter an exchange rate.");
  const text = String(raw).trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(text)) {
    fxFail("The exchange rate must be a positive number with up to six decimals.");
  }
  const [whole, decimals = ""] = text.split(".");
  const micros = BigInt(whole!) * SCALE + BigInt(decimals.padEnd(6, "0"));
  if (micros <= 0n) fxFail("The exchange rate must be greater than zero.");
  return micros;
}

/** Human-readable rate, used for display and audit records. */
export function formatRate(rateMicros: bigint): string {
  const whole = rateMicros / SCALE;
  const frac = (rateMicros % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/**
 * CONVERSION RULE (single place, applied once to a final customer amount):
 * exact IDR -> exact division by the rate -> round UP to a whole unit.
 * Never call this per component, per option or per package line.
 */
export function convertIdrToCustomer(amountIdr: number, rateMicros: bigint): number {
  if (!Number.isInteger(amountIdr) || amountIdr < 0) {
    fxFail("The amount to convert must be a whole, non-negative Rupiah amount.");
  }
  if (rateMicros <= 0n) fxFail("The exchange rate is not configured.");
  const numerator = BigInt(amountIdr) * SCALE;
  // Ceiling division: the customer-visible amount is always rounded up.
  const rounded = (numerator + rateMicros - 1n) / rateMicros;
  return Number(rounded);
}

export type CustomerMoney = {
  currency_code: string;
  /** Rupiah per one unit of the customer currency, as a decimal string. */
  rate: string;
  rate_effective_at: string;
  total_idr: number;
  /** Whole units of the customer currency, rounded up from the exact total. */
  total: number;
};

/**
 * Deposit + balance in the customer currency.
 *
 * The frozen total is converted once. The deposit is converted from its exact
 * Rupiah amount and clamped, then the balance is the remainder, so
 * deposit + balance = total holds exactly in the customer currency too.
 */
export function customerSplit(
  totalIdr: number,
  depositIdr: number,
  rateMicros: bigint,
): { total: number; first_payment: number; outstanding: number } {
  const total = convertIdrToCustomer(totalIdr, rateMicros);
  const deposit = Math.min(convertIdrToCustomer(depositIdr, rateMicros), total);
  return { total, first_payment: deposit, outstanding: total - deposit };
}

/** Display helper: whole units, no decimals, because amounts are rounded up. */
export function formatCustomerAmount(amount: number, code: string, symbol?: string | null): string {
  const value = Math.round(amount).toLocaleString("en-US");
  return symbol ? `${symbol}${value}` : `${code} ${value}`;
}

/**
 * Currency & FX — server-only.
 *
 * Rates live in `fx_rates` (one current row per customer currency, IDR base).
 * The browser never supplies a rate or a converted amount: every customer
 * amount shown or frozen is computed here from the current stored rate.
 */
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import {
  BASE_CURRENCY,
  FALLBACK_CURRENCY,
  convertIdrToCustomer,
  customerSplit,
  formatRate,
  isBaseCurrency,
  parseRateMicros,
} from "@/lib/fx";

export const CURRENCY_COOKIE = "cbr_currency";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type SupportedCurrency = {
  code: string;
  name: string;
  symbol: string;
  is_base: boolean;
};

/** Customer-facing currency list: active currencies only, base included. */
export async function listSupportedCurrencies(): Promise<SupportedCurrency[]> {
  const db = await admin();
  const { data } = await db
    .from("currencies")
    .select("code, name, symbol, is_base, is_active, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("code", { ascending: true });
  return (data ?? []).map((row: any) => ({
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    is_base: row.is_base === true,
  }));
}

function readCookieCurrency(): string | null {
  try {
    const header = getRequest().headers.get("cookie");
    if (!header) return null;
    for (const part of header.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === CURRENCY_COOKIE) {
        const value = rest.join("=").toUpperCase();
        return /^[A-Z]{3}$/.test(value) ? value : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function writeCookieCurrency(code: string) {
  setResponseHeader(
    "Set-Cookie",
    `${CURRENCY_COOKIE}=${code}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${60 * 60 * 24 * 30}`,
  );
}

/** Market default, used when the visitor has made no explicit choice. */
async function marketDefaultCurrency(): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("markets")
    .select("default_currency_code, display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.default_currency_code as string | undefined) ?? null;
}

export type FxContext = {
  /** Currency the customer sees. May be the base currency. */
  currency_code: string;
  currencies: SupportedCurrency[];
  /** Null when the customer currency is IDR (no conversion applies). */
  rate: string | null;
  rate_effective_at: string | null;
  rate_micros: bigint | null;
  symbol: string;
  /** True when no usable rate exists, so amounts fall back to Rupiah. */
  fell_back_to_base: boolean;
};

async function currentRateMicros(
  code: string,
): Promise<{ micros: bigint; effective_at: string } | null> {
  if (isBaseCurrency(code)) return null;
  const db = await admin();
  const { data } = await db
    .from("fx_rates")
    .select("rate, effective_at")
    .eq("base_currency_code", BASE_CURRENCY)
    .eq("quote_currency_code", code)
    .eq("is_current", true)
    .maybeSingle();
  if (!data?.rate) return null;
  return { micros: parseRateMicros(String(data.rate)), effective_at: String(data.effective_at) };
}

/**
 * Resolves the currency for this request: explicit selection, else the active
 * market default, else the fallback, else the base currency.
 */
export async function fxContext(explicit?: string | null): Promise<FxContext> {
  const currencies = await listSupportedCurrencies();
  const supported = new Set(currencies.map((c) => c.code));

  const candidates = [
    explicit?.toUpperCase(),
    readCookieCurrency(),
    await marketDefaultCurrency(),
    FALLBACK_CURRENCY,
    BASE_CURRENCY,
  ];
  let code: string = BASE_CURRENCY;
  for (const candidate of candidates) {
    if (candidate && supported.has(candidate)) {
      code = candidate;
      break;
    }
  }

  const symbolOf = (c: string) => currencies.find((x) => x.code === c)?.symbol ?? c;

  if (isBaseCurrency(code)) {
    return {
      currency_code: BASE_CURRENCY,
      currencies,
      rate: null,
      rate_effective_at: null,
      rate_micros: null,
      symbol: symbolOf(BASE_CURRENCY),
      fell_back_to_base: false,
    };
  }

  const rate = await currentRateMicros(code);
  if (!rate) {
    // A missing rate must never invent one: show Rupiah instead.
    return {
      currency_code: BASE_CURRENCY,
      currencies,
      rate: null,
      rate_effective_at: null,
      rate_micros: null,
      symbol: symbolOf(BASE_CURRENCY),
      fell_back_to_base: true,
    };
  }

  return {
    currency_code: code,
    currencies,
    rate: formatRate(rate.micros),
    rate_effective_at: rate.effective_at,
    rate_micros: rate.micros,
    symbol: symbolOf(code),
    fell_back_to_base: false,
  };
}

/** Stores the visitor's explicit choice for later requests. */
export async function selectCurrency(code: string): Promise<FxContext> {
  const wanted = String(code ?? "").toUpperCase();
  const context = await fxContext(wanted);
  if (context.currency_code === wanted || (isBaseCurrency(wanted) && context.currency_code === BASE_CURRENCY)) {
    writeCookieCurrency(context.currency_code);
  }
  return context;
}

/** Converts one final amount for display. Base currency passes through. */
export function displayAmount(amountIdr: number, context: FxContext): number {
  if (!context.rate_micros) return amountIdr;
  return convertIdrToCustomer(amountIdr, context.rate_micros);
}

/**
 * The frozen FX record written onto a Purchase and its payment requests.
 * Returns null in the base currency: there is nothing to freeze.
 */
export function freezeFx(
  context: FxContext,
  totalIdr: number,
  firstPaymentIdr: number,
): {
  customer_currency_code: string;
  fx_rate: string;
  fx_effective_at: string;
  customer_total_amount: number;
  customer_first_payment_amount: number;
  customer_outstanding_amount: number;
} | null {
  if (!context.rate_micros || !context.rate || !context.rate_effective_at) return null;
  const split = customerSplit(totalIdr, firstPaymentIdr, context.rate_micros);
  return {
    customer_currency_code: context.currency_code,
    fx_rate: context.rate,
    fx_effective_at: context.rate_effective_at,
    customer_total_amount: split.total,
    customer_first_payment_amount: split.first_payment,
    customer_outstanding_amount: split.outstanding,
  };
}

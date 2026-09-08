/**
 * Currency & FX — server functions.
 *
 * Public: read the active currency context and change the selection.
 * Admin: read the rate list and set a new current rate (RLS-authoritative).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FxError, formatRate, parseRateMicros, BASE_CURRENCY } from "@/lib/fx";
import { fxContext, listSupportedCurrencies, selectCurrency, type FxContext } from "@/lib/fx.server";

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

export type PublicFxContext = {
  currency_code: string;
  symbol: string;
  rate: string | null;
  rate_effective_at: string | null;
  fell_back_to_base: boolean;
  currencies: { code: string; name: string; symbol: string }[];
};

/** bigint rate micros stay on the server; the browser only sees safe values. */
export function toPublicFx(context: FxContext): PublicFxContext {
  return {
    currency_code: context.currency_code,
    symbol: context.symbol,
    rate: context.rate,
    rate_effective_at: context.rate_effective_at,
    fell_back_to_base: context.fell_back_to_base,
    currencies: context.currencies.map((c) => ({ code: c.code, name: c.name, symbol: c.symbol })),
  };
}

export const getFxContext = createServerFn({ method: "GET" }).handler(async () =>
  toPublicFx(await fxContext()),
);

export const setFxCurrency = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().length(3) }).parse(input),
  )
  .handler(async ({ data }) => toPublicFx(await selectCurrency(data.code)));

/* ------------------------------------------------------------------ */
/* Admin rate management                                               */
/* ------------------------------------------------------------------ */

export type AdminFxRate = {
  currency_code: string;
  currency_name: string;
  symbol: string;
  rate: string | null;
  effective_at: string | null;
  source: string | null;
};

export const listFxRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminFxRate[]> => {
    const supabase = (context as any).supabase;
    const currencies = await listSupportedCurrencies();
    const { data, error } = await supabase
      .from("fx_rates")
      .select("quote_currency_code, rate, effective_at, source")
      .eq("is_current", true);
    if (error) throw new FxError(SAFE_ERROR);
    const byCode = new Map<string, any>((data ?? []).map((r: any) => [r.quote_currency_code, r]));
    return currencies
      .filter((c) => c.code !== BASE_CURRENCY)
      .map((c) => {
        const row = byCode.get(c.code);
        return {
          currency_code: c.code,
          currency_name: c.name,
          symbol: c.symbol,
          rate: row ? formatRate(parseRateMicros(String(row.rate))) : null,
          effective_at: row ? String(row.effective_at) : null,
          source: row ? String(row.source) : null,
        };
      });
  });

/**
 * Sets the current rate for one currency. The previous row is kept as history
 * (is_current = false), so past rates remain auditable. RLS allows only ADMIN.
 */
export const setFxRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; rate: string }) =>
    z.object({ code: z.string().trim().length(3), rate: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const code = data.code.toUpperCase();
    if (code === BASE_CURRENCY) throw new FxError("The base currency has no exchange rate.");

    const currencies = await listSupportedCurrencies();
    if (!currencies.some((c) => c.code === code)) {
      throw new FxError("This currency is not active.");
    }

    const micros = parseRateMicros(data.rate);
    const rate = formatRate(micros);

    const { data: previous } = await supabase
      .from("fx_rates")
      .select("id, rate")
      .eq("quote_currency_code", code)
      .eq("is_current", true)
      .maybeSingle();

    if (previous?.id) {
      const { error: retireError } = await supabase
        .from("fx_rates")
        .update({ is_current: false })
        .eq("id", previous.id);
      if (retireError) throw new FxError(SAFE_ERROR);
    }

    const { error: insertError } = await supabase.from("fx_rates").insert({
      base_currency_code: BASE_CURRENCY,
      quote_currency_code: code,
      rate,
      source: "manual",
      is_current: true,
    });
    if (insertError) throw new FxError(SAFE_ERROR);

    await supabase.from("admin_audit_log").insert({
      actor_id: userId,
      action: "fx_rate_updated",
      entity_type: "fx_rates",
      entity_ref: code,
      details: { from: previous?.rate ? String(previous.rate) : null, to: rate },
    });

    return { ok: true, code, rate };
  });

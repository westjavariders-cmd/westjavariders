import type { Database } from "@/integrations/supabase/types";
import type { ProductBundle } from "@/lib/catalog";
import {
  exactDiv,
  exactMul,
  exactToString,
  fromNumberLike,
  priceProduct,
  toRupiah,
  type Exact,
  type BreakdownLine,
  type FormulaVersion,
  type PricingInputs,
  type PricingRule,
  type PricingTier,
  type ProductPricing,
} from "@/lib/pricing";

/**
 * Commercial layer: season and promotion applied on top of the Phase 4 price.
 *
 * Pipeline: configuration → Phase 4 price → season → promotion → final IDR.
 * There is only one pricing engine; this module never recalculates a product
 * price itself, it only discounts the amounts Phase 4 produced.
 */

type T = Database["public"]["Tables"];
export type SeasonSettings = T["product_season_settings"]["Row"];
export type SeasonPeriodRow = T["product_season_periods"]["Row"];
export type SeasonMonthRow = T["product_season_months"]["Row"];
export type PromoCode = T["promo_codes"]["Row"];

export const SEASON_PERIODS = ["HIGH", "MID", "LOW"] as const;
export type SeasonPeriod = (typeof SEASON_PERIODS)[number];

export const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

/** Insurance never carries a season or a promotion. */
export const isDiscountableKind = (kind: string) => kind !== "insurance";

const HUNDRED = fromNumberLike(100);
const percentOf = (amount: Exact, percentage: string | number): Exact =>
  exactMul(amount, exactDiv(fromNumberLike(percentage), HUNDRED));

export type SeasonConfig = {
  settings: SeasonSettings | null;
  periods: SeasonPeriodRow[];
  months: SeasonMonthRow[];
};

export type PromoContext = {
  promo: PromoCode | null;
  productId: string;
  categoryIds: string[];
  promoProductIds: string[];
  promoCategoryIds: string[];
  isGift: boolean;
  now: Date;
};

export type CommercialResult = {
  phase4_total_idr: number;
  season_period: SeasonPeriod | null;
  season_discount_percentage: string | null;
  season_discount_idr: number;
  promo_code: string | null;
  promo_discount_percentage: string | null;
  promo_discount_idr: number;
  final_total_idr: number;
  lines: (BreakdownLine & {
    season_eligible: boolean;
    promo_eligible: boolean;
    season_discount_idr_exact: string;
    promo_discount_idr_exact: string;
  })[];
  promo_rejection: string | null;
  errors: string[];
};

/** The month a season lookup uses. Provided by the caller; no calendar here. */
export function monthOf(date: Date): number {
  return date.getUTCMonth() + 1;
}

export function seasonPeriodForMonth(config: SeasonConfig, month: number): SeasonPeriod | null {
  if (!config.settings?.enabled) return null;
  const row = config.months.find((m) => m.month === month);
  return (row?.period as SeasonPeriod | undefined) ?? null;
}

export function seasonPercentage(config: SeasonConfig, period: SeasonPeriod | null): string {
  if (!period) return "0";
  const row = config.periods.find((p) => p.period === period);
  return String(row?.discount_percentage ?? 0);
}

/**
 * Whether a promo may be used at all. Product/category eligibility is
 * inclusive: no explicit product and no explicit category means "any product".
 */
export function promoRejection(ctx: PromoContext, productKind: string): string | null {
  const { promo } = ctx;
  if (!promo) return null;
  if (!isDiscountableKind(productKind)) return "Insurance can never receive a promotion.";
  if (!promo.active) return "This promo code is not active.";
  if (promo.starts_at && new Date(promo.starts_at) > ctx.now) return "This promo code is not valid yet.";
  if (promo.expires_at && new Date(promo.expires_at) <= ctx.now) return "This promo code has expired.";
  if (ctx.isGift && !promo.gift_eligible) return "This promo code cannot be used on a gift.";
  const scoped = ctx.promoProductIds.length > 0 || ctx.promoCategoryIds.length > 0;
  if (scoped) {
    const byProduct = ctx.promoProductIds.includes(ctx.productId);
    const byCategory = ctx.promoCategoryIds.some((c) => ctx.categoryIds.includes(c));
    if (!byProduct && !byCategory) return "This promo code does not apply to this product.";
  }
  return null;
}

/** Season/promo eligibility of one Phase 4 breakdown line. */
function lineEligibility(
  line: BreakdownLine,
  bundle: ProductBundle,
  rules: PricingRule[],
): { season: boolean; promo: boolean } {
  const match = /^rule:(.+)$/.exec(line.source);
  if (match) {
    const rule = rules.find((r) => r.id === match[1]);
    if (rule?.rule_type === "component_quantity") {
      const component = bundle.components.find((c) => c.id === rule.component_id);
      if (component) {
        return { season: component.season_eligible, promo: component.promo_eligible };
      }
    }
  }
  return { season: true, promo: true };
}

/**
 * Applies season then promotion. Where both compete for the same eligible
 * amount, only the greater monetary discount is taken; where they apply to
 * different amounts, both coexist.
 */
export function priceCommercial(args: {
  bundle: ProductBundle;
  pricing: ProductPricing;
  rules: PricingRule[];
  tiers: PricingTier[];
  formula: FormulaVersion | null;
  inputs: PricingInputs;
  season: SeasonConfig;
  month: number;
  promoContext: PromoContext;
}): CommercialResult {
  const { bundle, pricing, rules, tiers, formula, inputs, season, month, promoContext } = args;

  const base = priceProduct({ bundle, pricing, rules, tiers, formula, inputs });
  const kind = bundle.product.kind as string;

  const period = isDiscountableKind(kind) ? seasonPeriodForMonth(season, month) : null;
  const seasonPct = seasonPercentage(season, period);
  const rejection = promoRejection(promoContext, kind);
  const promo = rejection ? null : promoContext.promo;
  const promoPct = promo ? String(promo.discount_percentage) : "0";

  let seasonTotal = 0n;
  let promoTotal = 0n;

  const lines = base.lines.map((line) => {
    const eligible = lineEligibility(line, bundle, rules);
    const amount = fromNumberLike(line.amount_idr_exact);
    let seasonCut = 0n;
    let promoCut = 0n;

    if (amount > 0n) {
      const s = eligible.season && period ? percentOf(amount, seasonPct) : 0n;
      const p = eligible.promo && promo ? percentOf(amount, promoPct) : 0n;
      if (s > 0n && p > 0n) {
        // Same eligible amount: only the greater monetary discount applies.
        if (p >= s) promoCut = p;
        else seasonCut = s;
      } else {
        seasonCut = s;
        promoCut = p;
      }
    }

    seasonTotal += seasonCut;
    promoTotal += promoCut;

    return {
      ...line,
      season_eligible: eligible.season,
      promo_eligible: eligible.promo,
      season_discount_idr_exact: exactToString(seasonCut),
      promo_discount_idr_exact: exactToString(promoCut),
    };
  });

  const errors = [...base.errors];
  const seasonIdr = toRupiah(seasonTotal);
  const promoIdr = toRupiah(promoTotal);
  const final = base.total_idr - seasonIdr - promoIdr;
  if (final < 0) errors.push("The discounts produced a negative price.");

  return {
    phase4_total_idr: base.total_idr,
    season_period: period,
    season_discount_percentage: period ? seasonPct : null,
    season_discount_idr: seasonIdr,
    promo_code: promo?.code ?? null,
    promo_discount_percentage: promo ? promoPct : null,
    promo_discount_idr: promoIdr,
    final_total_idr: final < 0 ? 0 : final,
    lines,
    promo_rejection: rejection,
    errors,
  };
}

export type SeasonIssue = { level: "error" | "warning"; message: string };

/** Rejects ambiguous or invalid seasonal configuration. */
export function validateSeason(config: SeasonConfig): SeasonIssue[] {
  const issues: SeasonIssue[] = [];
  if (!config.settings?.enabled) return issues;

  const seen = new Set<number>();
  for (const m of config.months) {
    if (m.month < 1 || m.month > 12) issues.push({ level: "error", message: `Month ${m.month} is not valid.` });
    if (seen.has(m.month)) {
      issues.push({ level: "error", message: `Month ${m.month} is assigned more than once.` });
    }
    seen.add(m.month);
    if (!SEASON_PERIODS.includes(m.period as SeasonPeriod)) {
      issues.push({ level: "error", message: `"${m.period}" is not a valid season.` });
    }
  }
  const missing = MONTHS.filter((m) => !seen.has(m.value));
  if (missing.length > 0) {
    issues.push({
      level: "error",
      message: `Every month needs a season: ${missing.map((m) => m.label).join(", ")}.`,
    });
  }
  for (const p of config.periods) {
    const pct = Number(p.discount_percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      issues.push({ level: "error", message: `The ${p.period} discount must be between 0% and 100%.` });
    }
    if (p.period === "HIGH" && pct !== 0) {
      issues.push({ level: "warning", message: "HIGH is the reference price and normally has no discount." });
    }
  }
  return issues;
}

import { describe, expect, it } from "vitest";

import { priceCommercial, validateSeason, promoRejection, MONTHS } from "@/lib/commercial";
import type { ProductBundle } from "@/lib/catalog";
import type { PricingRule, ProductPricing } from "@/lib/pricing";
import { resolveInputs } from "@/lib/pricing";

const now = new Date("2026-06-15T00:00:00Z");

function bundle(kind = "package"): ProductBundle {
  return {
    product: {
      id: "p1",
      kind,
      internal_name: "Surf trip",
      internal_ref: null,
      status: "active",
      sort_order: 0,
      created_at: "",
      updated_at: "",
    } as never,
    translation: null,
    categoryIds: ["cat-surf"],
    placements: [],
    components: [
      {
        id: "c1",
        product_id: "p1",
        source_template_id: null,
        internal_name: "Lesson",
        customer_name: null,
        customer_description: null,
        unit_basis: "per_person",
        internal_cost: "0",
        customer_price: "100000",
        min_quantity: "0",
        max_quantity: null,
        default_quantity: null,
        season_eligible: true,
        promo_eligible: false,
        display_order: 0,
        is_active: true,
        created_at: "",
        updated_at: "",
      } as never,
    ],
    flow: { id: "f1", product_id: "p1", internal_name: null, is_active: true } as never,
    steps: [],
    fields: [
      {
        id: "f-people",
        product_id: "p1",
        step_id: "s1",
        internal_name: "People",
        variable_name: "people",
        customer_label: null,
        help_text: null,
        field_type: "quantity",
        is_required: true,
        is_active: true,
        default_value: null,
        min_value: null,
        max_value: null,
        display_order: 0,
        created_at: "",
        updated_at: "",
      } as never,
    ],
    options: [],
    dependencies: [],
  };
}

const pricing = {
  id: "pr1",
  product_id: "p1",
  base_amount_idr: 1000000,
  mode: "structured",
  status: "active",
  active_version_id: null,
  people_variable: "people",
  days_variable: null,
  nights_variable: null,
  sessions_variable: null,
  notes: null,
  created_at: "",
  updated_at: "",
} as unknown as ProductPricing;

const componentRule = {
  id: "r1",
  pricing_id: "pr1",
  rule_type: "component_quantity",
  label: "Lessons",
  display_order: 0,
  amount_idr: null,
  variable_name: null,
  component_id: "c1",
  condition_variable: null,
  condition_operator: null,
  condition_value: null,
  sign: "add",
  is_active: true,
  created_at: "",
  updated_at: "",
} as unknown as PricingRule;

const season = {
  settings: { enabled: true } as never,
  periods: [
    { period: "HIGH", discount_percentage: "0" },
    { period: "MID", discount_percentage: "10" },
    { period: "LOW", discount_percentage: "20" },
  ] as never,
  months: MONTHS.map((m) => ({ month: m.value, period: m.value === 2 ? "LOW" : "HIGH" })) as never,
};

const promo = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "promo1",
    code: "SUMMER",
    internal_name: "Summer",
    discount_percentage: "15",
    active: true,
    starts_at: null,
    expires_at: null,
    gift_eligible: false,
    notes: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as never;

function run(args: {
  kind?: string;
  month: number;
  promoRow?: unknown;
  isGift?: boolean;
  promoProductIds?: string[];
  promoCategoryIds?: string[];
}) {
  const b = bundle(args.kind);
  return priceCommercial({
    bundle: b,
    pricing,
    rules: [componentRule],
    tiers: [],
    formula: null,
    inputs: resolveInputs(b, { people: 2 }),
    season,
    month: args.month,
    promoContext: {
      promo: (args.promoRow ?? null) as never,
      productId: "p1",
      categoryIds: b.categoryIds,
      promoProductIds: args.promoProductIds ?? [],
      promoCategoryIds: args.promoCategoryIds ?? [],
      isGift: args.isGift === true,
      now,
    },
  });
}

describe("season and promotion engine", () => {
  it("charges the full price in a HIGH month with no promo", () => {
    const r = run({ month: 1 });
    expect(r.phase4_total_idr).toBe(1200000);
    expect(r.season_discount_idr).toBe(0);
    expect(r.final_total_idr).toBe(1200000);
  });

  it("applies the seasonal discount only to season-eligible amounts", () => {
    const r = run({ month: 2 });
    // base 1,000,000 (eligible) + component 200,000 (season eligible) → 20% of both
    expect(r.season_period).toBe("LOW");
    expect(r.season_discount_idr).toBe(240000);
    expect(r.final_total_idr).toBe(960000);
  });

  it("never stacks season and promo on the same amount, keeping the greater", () => {
    const r = run({ month: 2, promoRow: promo() });
    // base: season 20% (200,000) beats promo 15% (150,000)
    // component: promo not eligible → season 20% of 200,000 = 40,000
    expect(r.season_discount_idr).toBe(240000);
    expect(r.promo_discount_idr).toBe(0);
    expect(r.final_total_idr).toBe(960000);
  });

  it("lets a stronger promo replace the season on the same amount", () => {
    const r = run({ month: 2, promoRow: promo({ discount_percentage: "30" }) });
    // base: promo 30% (300,000) beats season 20%; component promo-ineligible → season 40,000
    expect(r.promo_discount_idr).toBe(300000);
    expect(r.season_discount_idr).toBe(40000);
    expect(r.final_total_idr).toBe(860000);
  });

  it("applies a promo alone when the product has no season", () => {
    const r = priceCommercial({
      bundle: bundle(),
      pricing,
      rules: [componentRule],
      tiers: [],
      formula: null,
      inputs: resolveInputs(bundle(), { people: 2 }),
      season: { settings: null, periods: [], months: [] },
      month: 2,
      promoContext: {
        promo: promo(),
        productId: "p1",
        categoryIds: ["cat-surf"],
        promoProductIds: [],
        promoCategoryIds: [],
        isGift: false,
        now,
      },
    });
    expect(r.season_discount_idr).toBe(0);
    expect(r.promo_discount_idr).toBe(150000);
  });

  it("refuses any promotion on insurance", () => {
    const r = run({ kind: "insurance", month: 2, promoRow: promo() });
    expect(r.promo_discount_idr).toBe(0);
    expect(r.season_discount_idr).toBe(0);
    expect(r.promo_rejection).toMatch(/Insurance/);
  });

  it("refuses a gift when the promo is not gift eligible", () => {
    const r = run({ month: 1, promoRow: promo(), isGift: true });
    expect(r.promo_discount_idr).toBe(0);
    expect(r.promo_rejection).toMatch(/gift/);
  });

  it("refuses an expired or inactive promo", () => {
    expect(
      promoRejection(
        {
          promo: promo({ expires_at: "2026-01-01T00:00:00Z" }),
          productId: "p1",
          categoryIds: [],
          promoProductIds: [],
          promoCategoryIds: [],
          isGift: false,
          now,
        },
        "package",
      ),
    ).toMatch(/expired/);
    expect(
      promoRejection(
        {
          promo: promo({ active: false }),
          productId: "p1",
          categoryIds: [],
          promoProductIds: [],
          promoCategoryIds: [],
          isGift: false,
          now,
        },
        "package",
      ),
    ).toMatch(/not active/);
  });

  it("honours product and category eligibility", () => {
    expect(run({ month: 1, promoRow: promo(), promoProductIds: ["other"] }).promo_rejection).toMatch(
      /does not apply/,
    );
    expect(
      run({ month: 1, promoRow: promo(), promoCategoryIds: ["cat-surf"] }).promo_discount_idr,
    ).toBe(150000); // only the base is promo eligible; the component is not
  });

  it("rejects an incomplete month mapping when seasons are on", () => {
    const issues = validateSeason({
      settings: { enabled: true } as never,
      periods: [],
      months: [{ month: 1, period: "HIGH" } as never],
    });
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});

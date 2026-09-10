import { describe, expect, it } from "vitest";

import { priceProduct, resolveInputs } from "@/lib/pricing";
import { findOptionComponentRule, linkedComponentIds } from "@/lib/option-components";

/**
 * Option → Component links are the existing structured component pricing rules.
 * These tests cover linking, unlinking and the pricing result of a selection.
 */

const field = (o: any) => ({
  id: o.id,
  product_id: "p",
  step_id: "s",
  internal_name: o.n,
  variable_name: o.n,
  customer_label: null,
  help_text: null,
  field_type: o.t,
  is_required: false,
  is_active: true,
  default_value: null,
  min_value: null,
  max_value: null,
  display_order: 0,
  created_at: "",
  updated_at: "",
});

const component = (o: any) => ({
  id: o.id,
  product_id: "p",
  internal_name: o.n,
  unit_basis: o.b,
  customer_price: o.price,
  internal_cost: "0",
  is_active: true,
  display_order: 0,
});

const bundle: any = {
  product: { id: "p", status: "active", internal_name: "Media product", kind: "package" },
  translation: { title: "Media" },
  categoryIds: [],
  placements: [],
  components: [
    component({ id: "video", n: "Video", b: "fixed", price: "900000" }),
    component({ id: "analysis", n: "Video Analysis", b: "fixed", price: "400000" }),
    component({ id: "photo", n: "Photography", b: "fixed", price: "750000" }),
    component({ id: "board", n: "Surf Board", b: "per_person", price: "100000" }),
  ],
  flow: { id: "f", is_active: true },
  steps: [{ id: "s", flow_id: "f", is_active: true, display_order: 0, internal_name: "Step" }],
  fields: [
    field({ id: "f1", n: "people", t: "quantity" }),
    field({ id: "f2", n: "boards", t: "quantity" }),
    field({ id: "f3", n: "accommodation", t: "single_select" }),
    field({ id: "f4", n: "media", t: "single_select" }),
  ],
  options: [
    { id: "oy", field_id: "f3", internal_value: "YES", is_active: true, is_default: false, display_order: 0 },
    { id: "on", field_id: "f3", internal_value: "NO", is_active: true, is_default: false, display_order: 1 },
    { id: "o1", field_id: "f4", internal_value: "video_plus_analysis", is_active: true, is_default: false, display_order: 0 },
    { id: "o2", field_id: "f4", internal_value: "photography", is_active: true, is_default: false, display_order: 1 },
  ],
  dependencies: [],
};

const pricing: any = {
  id: "pr",
  product_id: "p",
  mode: "structured",
  status: "active",
  base_amount_idr: 0,
  people_variable: "people",
  days_variable: null,
  nights_variable: null,
  sessions_variable: null,
  active_version_id: null,
};

/** A stored Option → Component link, exactly as the Admin UI creates it. */
const link = (o: any): any => ({
  id: o.id,
  pricing_id: "pr",
  label: o.component,
  rule_type: "component_quantity",
  component_id: o.component,
  quantity_variable: o.quantity ?? null,
  condition_variable: o.variable,
  condition_operator: "equals",
  condition_value: o.value,
  amount_idr: null,
  variable_name: null,
  sign: "add",
  is_active: true,
  display_order: o.order ?? 0,
});

const unrelated = (): any => ({
  id: "fee",
  pricing_id: "pr",
  label: "booking fee",
  rule_type: "fixed",
  amount_idr: 50000,
  component_id: null,
  quantity_variable: null,
  variable_name: null,
  condition_variable: null,
  condition_operator: null,
  condition_value: null,
  sign: "add",
  is_active: true,
  display_order: 9,
});

const price = (rules: any[], values: Record<string, unknown>) =>
  priceProduct({
    bundle,
    pricing,
    rules,
    tiers: [],
    formula: null,
    inputs: resolveInputs(bundle, { people: 2, boards: 2, ...values } as never),
  });

describe("option → component links", () => {
  it("charges the linked component when the option is selected", () => {
    const rules = [link({ id: "l1", component: "video", variable: "media", value: "video_plus_analysis" })];
    const r = price(rules, { media: "video_plus_analysis" });
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(900000);
  });

  it("charges every component linked to one option", () => {
    const rules = [
      link({ id: "l1", component: "video", variable: "media", value: "video_plus_analysis", order: 0 }),
      link({ id: "l2", component: "analysis", variable: "media", value: "video_plus_analysis", order: 1 }),
    ];
    const r = price(rules, { media: "video_plus_analysis" });
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(900000 + 400000);
    expect(linkedComponentIds(rules, "media", "video_plus_analysis")).toEqual(["video", "analysis"]);
  });

  it("selecting a different option charges only that option's components", () => {
    const rules = [
      link({ id: "l1", component: "video", variable: "media", value: "video_plus_analysis", order: 0 }),
      link({ id: "l2", component: "analysis", variable: "media", value: "video_plus_analysis", order: 1 }),
      link({ id: "l3", component: "photo", variable: "media", value: "photography", order: 2 }),
    ];
    expect(price(rules, { media: "photography" }).total_idr).toBe(750000);
    expect(price(rules, { media: "video_plus_analysis" }).total_idr).toBe(900000 + 400000);
  });

  it("finds only the exact link, so unlinking leaves unrelated rules alone", () => {
    const rules = [
      link({ id: "l1", component: "video", variable: "media", value: "video_plus_analysis", order: 0 }),
      link({ id: "l3", component: "photo", variable: "media", value: "photography", order: 1 }),
      unrelated(),
    ];
    const found = findOptionComponentRule(rules, {
      componentId: "video",
      variableName: "media",
      internalValue: "video_plus_analysis",
    });
    expect(found?.id).toBe("l1");

    const remaining = rules.filter((r) => r.id !== found!.id);
    expect(remaining.map((r) => r.id)).toEqual(["l3", "fee"]);
    expect(price(remaining, { media: "photography" }).total_idr).toBe(750000 + 50000);
  });

  it("does not match a link whose option value or question differs", () => {
    const rules = [link({ id: "l1", component: "video", variable: "media", value: "video_plus_analysis" })];
    expect(
      findOptionComponentRule(rules, {
        componentId: "video",
        variableName: "media",
        internalValue: "photography",
      }),
    ).toBeNull();
    expect(
      findOptionComponentRule(rules, {
        componentId: "video",
        variableName: "extras",
        internalValue: "video_plus_analysis",
      }),
    ).toBeNull();
  });

  it("keeps using the existing quantity question for a linked component", () => {
    const rules = [
      link({ id: "l4", component: "board", variable: "media", value: "photography", quantity: "boards" }),
    ];
    expect(price(rules, { media: "photography" }).total_idr).toBe(100000 * 2);
  });

  it("does not charge a linked component when its option is hidden and reset", () => {
    const hiddenBundle = {
      ...bundle,
      dependencies: [
        {
          id: "d1",
          product_id: "p",
          source_field_id: "f3",
          source_option_id: null,
          operator: "equals",
          compare_value: "NO",
          action: "reset_remove",
          action_value: null,
          target_field_id: "f4",
          target_option_id: null,
          is_active: true,
        },
      ],
    };
    const rules = [link({ id: "l1", component: "video", variable: "media", value: "video_plus_analysis" })];
    const r = priceProduct({
      bundle: hiddenBundle as never,
      pricing,
      rules,
      tiers: [],
      formula: null,
      inputs: resolveInputs(hiddenBundle as never, {
        people: 2,
        accommodation: "NO",
        media: "video_plus_analysis",
      } as never),
    });
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(0);
  });

  it("leaves existing pricing untouched when no option link exists", () => {
    const r = price([unrelated()], { media: "photography" });
    expect(r.total_idr).toBe(50000);
  });
});

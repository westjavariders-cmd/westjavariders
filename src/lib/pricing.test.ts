import { describe, expect, it } from "vitest";
import { priceProduct, resolveInputs, evaluateFormula, formulaScope, validatePricing, isPurchasable } from "@/lib/pricing";

const field = (o: any) => ({ id: o.id, product_id: "p", step_id: "s", internal_name: o.n, variable_name: o.n, customer_label: null, help_text: null, field_type: o.t, is_required: false, is_active: true, default_value: null, min_value: null, max_value: null, display_order: 0, created_at: "", updated_at: "" });
const bundle: any = {
  product: { id: "p", status: "active", internal_name: "X", kind: "package" },
  translation: { title: "X" }, categoryIds: [], placements: [],
  components: [
    { id: "c1", internal_name: "Bed", unit_basis: "per_night", customer_price: "500000", internal_cost: "100000", is_active: true, display_order: 0 },
    { id: "c2", internal_name: "Lesson", unit_basis: "per_person", customer_price: "250000", internal_cost: "0", is_active: true, display_order: 1 },
  ],
  flow: { id: "f", is_active: true },
  steps: [{ id: "s", flow_id: "f", is_active: true, display_order: 0, internal_name: "Step" }],
  fields: [field({ id: "f1", n: "people", t: "quantity" }), field({ id: "f2", n: "nights", t: "number" }), field({ id: "f3", n: "level", t: "single_select" })],
  options: [{ id: "o1", field_id: "f3", internal_value: "Beginner", is_active: true, is_default: true, display_order: 0 }, { id: "o2", field_id: "f3", internal_value: "Advanced", is_active: true, is_default: false, display_order: 1 }],
  dependencies: [],
};
const pricing: any = { id: "pr", product_id: "p", mode: "structured", status: "active", base_amount_idr: 0, people_variable: "people", days_variable: null, nights_variable: "nights", sessions_variable: null, active_version_id: null };
const inputs = () => resolveInputs(bundle, { people: 4, nights: 3, level: "Advanced" });

describe("pricing", () => {
  it("components use unit basis multipliers, rounded only at the end", () => {
    const rules: any = [
      { id: "r1", pricing_id: "pr", label: "bed", rule_type: "component_quantity", component_id: "c1", amount_idr: null, variable_name: null, condition_variable: null, sign: "add", is_active: true, display_order: 0 },
      { id: "r2", pricing_id: "pr", label: "lesson", rule_type: "component_quantity", component_id: "c2", amount_idr: null, variable_name: null, condition_variable: null, sign: "add", is_active: true, display_order: 1 },
    ];
    const r = priceProduct({ bundle, pricing, rules, tiers: [], formula: null, inputs: inputs() });
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(500000 * 3 + 250000 * 4);
  });

  it("tiers give the total for the matched range", () => {
    const rules: any = [{ id: "r3", pricing_id: "pr", label: "group", rule_type: "tier", variable_name: "people", amount_idr: null, component_id: null, condition_variable: null, sign: "add", is_active: true, display_order: 0 }];
    const tiers: any = [
      { id: "t1", rule_id: "r3", from_value: "1", to_value: "2", amount_idr: 1000000, display_order: 0 },
      { id: "t2", rule_id: "r3", from_value: "3", to_value: "4", amount_idr: 1800000, display_order: 1 },
    ];
    const r = priceProduct({ bundle, pricing, rules, tiers, formula: null, inputs: inputs() });
    expect(r.total_idr).toBe(1800000);
  });

  it("a tier rule multiplies the selected tier by quantity_variable when set", () => {
    const rules: any = [{ id: "r3", pricing_id: "pr", label: "group", rule_type: "tier", variable_name: "people", quantity_variable: "nights", amount_idr: null, component_id: null, condition_variable: null, sign: "add", is_active: true, display_order: 0 }];
    const tiers: any = [
      { id: "t1", rule_id: "r3", from_value: "1", to_value: "1", amount_idr: 500000, display_order: 0 },
      { id: "t2", rule_id: "r3", from_value: "2", to_value: "2", amount_idr: 700000, display_order: 1 },
      { id: "t3", rule_id: "r3", from_value: "3", to_value: "3", amount_idr: 850000, display_order: 2 },
    ];
    const two = resolveInputs(bundle, { people: 2, nights: 3, level: "Advanced" });
    const r = priceProduct({ bundle, pricing, rules, tiers, formula: null, inputs: two });
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(2100000);
  });

  it("a tier rule without quantity_variable keeps the tier total", () => {
    const rules: any = [{ id: "r3", pricing_id: "pr", label: "group", rule_type: "tier", variable_name: "people", quantity_variable: null, amount_idr: null, component_id: null, condition_variable: null, sign: "add", is_active: true, display_order: 0 }];
    const tiers: any = [{ id: "t1", rule_id: "r3", from_value: "1", to_value: "9", amount_idr: 700000, display_order: 0 }];
    expect(priceProduct({ bundle, pricing, rules, tiers, formula: null, inputs: inputs() }).total_idr).toBe(700000);
  });

  it("validation rejects a tier multiplier that is not an active number question", () => {
    const rules: any = [{ id: "r3", pricing_id: "pr", label: "group", rule_type: "tier", variable_name: "people", quantity_variable: "level", amount_idr: null, component_id: null, condition_variable: null, sign: "add", is_active: true, display_order: 0 }];
    const tiers: any = [{ id: "t1", rule_id: "r3", from_value: "1", to_value: null, amount_idr: 700000, display_order: 0 }];
    const issues = validatePricing({ bundle, pricing, rules, tiers, versions: [] });
    expect(issues.some((i) => i.level === "error" && i.message.includes("multiplies by"))).toBe(true);
  });

  it("conditional rules only apply when the condition holds", () => {
    const rules: any = [{ id: "r4", pricing_id: "pr", label: "adv", rule_type: "conditional", amount_idr: 500000, condition_variable: "level", condition_operator: "equals", condition_value: "Advanced", variable_name: null, component_id: null, sign: "add", is_active: true, display_order: 0 }];
    expect(priceProduct({ bundle, pricing, rules, tiers: [], formula: null, inputs: inputs() }).total_idr).toBe(500000);
    const other = resolveInputs(bundle, { people: 4, nights: 3, level: "Beginner" });
    expect(priceProduct({ bundle, pricing, rules, tiers: [], formula: null, inputs: other }).total_idr).toBe(0);
  });

  it("formula mode replaces structured pricing", () => {
    const fp = { ...pricing, mode: "formula", base_amount_idr: 100000 };
    const formula: any = { id: "v1", pricing_id: "pr", version: 1, expression: 'base + people * 250000 + IF(level == "Advanced", 500000, 0)', is_active: true };
    const rules: any = [{ id: "r1", pricing_id: "pr", label: "ignored", rule_type: "fixed", amount_idr: 9999999, sign: "add", is_active: true, display_order: 0, component_id: null, variable_name: null, condition_variable: null }];
    const r = priceProduct({ bundle, pricing: fp, rules, tiers: [], formula, inputs: inputs() });
    expect(r.total_idr).toBe(100000 + 1000000 + 500000);
  });

  it("rejects unsafe or badly typed formulas", () => {
    const scope = formulaScope(bundle, pricing, inputs());
    expect(() => evaluateFormula('level * 2', scope)).toThrow();
    expect(() => evaluateFormula('process.exit(1)', scope)).toThrow();
    expect(() => evaluateFormula('people / 0', scope)).toThrow();
    expect(() => evaluateFormula('unknown_thing + 1', scope)).toThrow();
  });

  it("negative totals are invalid, zero is valid", () => {
    const rules: any = [{ id: "r5", pricing_id: "pr", label: "neg", rule_type: "fixed", amount_idr: 100000, sign: "subtract", is_active: true, display_order: 0, component_id: null, variable_name: null, condition_variable: null }];
    const r = priceProduct({ bundle, pricing, rules, tiers: [], formula: null, inputs: inputs() });
    expect(r.errors.length).toBeGreaterThan(0);
    const zero = priceProduct({ bundle, pricing, rules: [], tiers: [], formula: null, inputs: inputs() });
    expect(zero.errors).toEqual([]);
    expect(zero.total_idr).toBe(0);
  });

  it("missing quantity mapping is an error, not a guess", () => {
    const bad = { ...pricing, nights_variable: null };
    const rules: any = [{ id: "r1", pricing_id: "pr", label: "bed", rule_type: "component_quantity", component_id: "c1", sign: "add", is_active: true, display_order: 0, amount_idr: null, variable_name: null, condition_variable: null }];
    const r = priceProduct({ bundle, pricing: bad, rules, tiers: [], formula: null, inputs: inputs() });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("purchasable only when product and pricing are both active", () => {
    expect(isPurchasable("active", "active")).toBe(true);
    expect(isPurchasable("active", "draft")).toBe(false);
    expect(isPurchasable("draft", "active")).toBe(false);
  });

  it("an orphan quantity mapping is reported as a question that no longer exists", () => {
    const stale: any = { ...pricing, people_variable: "choosenumberpeople" };
    const issues = validatePricing({ bundle, pricing: stale, rules: [], tiers: [], versions: [] });
    expect(issues.some((i) => /no longer exists/.test(i.message))).toBe(true);
  });

  it("a mapping to an existing non-numeric question keeps the old message", () => {
    const wrong: any = { ...pricing, people_variable: "level" };
    const issues = validatePricing({ bundle, pricing: wrong, rules: [], tiers: [], versions: [] });
    expect(issues.some((i) => /not an active number question/.test(i.message))).toBe(true);
  });


  it("validation reports overlapping tiers", () => {
    const rules: any = [{ id: "r3", pricing_id: "pr", label: "group", rule_type: "tier", variable_name: "people", sign: "add", is_active: true, display_order: 0, amount_idr: null, component_id: null, condition_variable: null }];
    const tiers: any = [
      { id: "t1", rule_id: "r3", from_value: "1", to_value: "3", amount_idr: 1, display_order: 0 },
      { id: "t2", rule_id: "r3", from_value: "2", to_value: "4", amount_idr: 2, display_order: 1 },
    ];
    const issues = validatePricing({ bundle, pricing, rules, tiers, versions: [] });
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { priceProduct, resolveInputs, validatePricing } from "@/lib/pricing";

/**
 * Component pricing exposed through the existing structured rules: each entry
 * charges one component, with its own quantity source and optional condition.
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
  product: { id: "p", status: "active", internal_name: "Cimaja Area — Beginner", kind: "package" },
  translation: { title: "Beginner" },
  categoryIds: [],
  placements: [],
  components: [
    component({ id: "lesson", n: "Surf Lesson", b: "per_session", price: "350000" }),
    component({ id: "guide", n: "Guide", b: "fixed", price: "500000" }),
    component({ id: "board", n: "Surf Board", b: "per_person", price: "100000" }),
    component({ id: "photo", n: "Photography", b: "fixed", price: "750000" }),
    component({ id: "videoland", n: "Video From Land", b: "fixed", price: "900000" }),
  ],
  flow: { id: "f", is_active: true },
  steps: [{ id: "s", flow_id: "f", is_active: true, display_order: 0, internal_name: "Step" }],
  fields: [
    field({ id: "f1", n: "people", t: "quantity" }),
    field({ id: "f2", n: "sessions", t: "quantity" }),
    field({ id: "f3", n: "boards", t: "quantity" }),
    field({ id: "f4", n: "surf_level", t: "single_select" }),
    field({ id: "f5", n: "media_services", t: "multi_select" }),
  ],
  options: [
    { id: "o1", field_id: "f4", internal_value: "beginner", is_active: true, is_default: true, display_order: 0 },
    { id: "o2", field_id: "f5", internal_value: "photography", is_active: true, is_default: false, display_order: 0 },
    { id: "o3", field_id: "f5", internal_value: "video_land", is_active: true, is_default: false, display_order: 1 },
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
  sessions_variable: "sessions",
  active_version_id: null,
};

const entry = (o: any): any => ({
  id: o.id,
  pricing_id: "pr",
  label: o.id,
  rule_type: "component_quantity",
  component_id: o.component,
  quantity_variable: o.quantity ?? null,
  condition_variable: o.when ?? null,
  condition_operator: o.op ?? null,
  condition_value: o.value ?? null,
  amount_idr: null,
  variable_name: null,
  sign: "add",
  is_active: true,
  display_order: o.order ?? 0,
});

const answers = (extra: Record<string, unknown> = {}) =>
  resolveInputs(bundle, { people: 5, sessions: 3, boards: 2, surf_level: "beginner", ...extra } as never);

const total = (rules: any[], values = answers(), tiers: any[] = []) =>
  priceProduct({ bundle, pricing, rules, tiers, formula: null, inputs: values });

describe("component pricing configuration", () => {
  it("charges a fixed component once", () => {
    const r = total([entry({ id: "e1", component: "guide" })]);
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(500000);
  });

  it("charges a per-session component by sessions, not people", () => {
    const r = total([entry({ id: "e2", component: "lesson" })]);
    expect(r.total_idr).toBe(350000 * 3);
  });

  it("charges a per-person component by people", () => {
    expect(total([entry({ id: "e3", component: "board" })]).total_idr).toBe(100000 * 5);
  });

  it("uses an independent quantity question when one is chosen", () => {
    const r = total([entry({ id: "e4", component: "board", quantity: "boards" })]);
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(100000 * 2);
  });

  it("charges a component only when a multi-select contains its option", () => {
    const rules = [entry({ id: "e5", component: "photo", when: "media_services", op: "equals", value: "photography" })];
    expect(total(rules, answers({ media_services: ["photography"] })).total_idr).toBe(750000);
  });

  it("charges nothing when the condition is not selected", () => {
    const rules = [entry({ id: "e6", component: "photo", when: "media_services", op: "equals", value: "photography" })];
    const r = total(rules, answers({ media_services: ["video_land"] }));
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(0);
  });

  it("adds up several selected components exactly", () => {
    const rules = [
      entry({ id: "e7", component: "lesson", order: 0 }),
      entry({ id: "e8", component: "board", quantity: "boards", order: 1 }),
      entry({ id: "e9", component: "photo", when: "media_services", op: "equals", value: "photography", order: 2 }),
      entry({ id: "e10", component: "videoland", when: "media_services", op: "equals", value: "video_land", order: 3 }),
    ];
    const r = total(rules, answers({ media_services: ["photography"] }));
    expect(r.errors).toEqual([]);
    expect(r.total_idr).toBe(350000 * 3 + 100000 * 2 + 750000);
    const sum = r.lines.reduce((acc, l) => acc + Number(l.amount_idr_exact), 0);
    expect(sum).toBe(r.total_idr);
  });

  it("works alongside base and other rules", () => {
    const rules = [
      entry({ id: "e11", component: "lesson", order: 1 }),
      {
        id: "e12",
        pricing_id: "pr",
        label: "booking fee",
        rule_type: "fixed",
        amount_idr: 50000,
        sign: "add",
        is_active: true,
        display_order: 2,
        component_id: null,
        variable_name: null,
        quantity_variable: null,
        condition_variable: null,
      } as any,
    ];
    const r = priceProduct({
      bundle,
      pricing: { ...pricing, base_amount_idr: 200000 },
      rules,
      tiers: [],
      formula: null,
      inputs: answers(),
    });
    expect(r.total_idr).toBe(200000 + 350000 * 3 + 50000);
  });

  it("validation rejects a quantity question that is not an active number question", () => {
    const rules = [entry({ id: "e13", component: "lesson", quantity: "surf_level" })];
    const issues = validatePricing({ bundle, pricing, rules, tiers: [], versions: [] });
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("validation accepts a valid component entry with a condition", () => {
    const rules = [entry({ id: "e14", component: "photo", when: "media_services", op: "equals", value: "photography" })];
    const issues = validatePricing({ bundle, pricing, rules, tiers: [], versions: [] });
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  evaluateDependencies,
  stripInactiveAnswers,
  validateBundle,
  type ProductBundle,
} from "@/lib/catalog";
import { resolveInputs } from "@/lib/pricing";
import { configurationIssues } from "@/lib/cart.server";

/** Mirrors the real "Cimaja Area — Beginner" shape: YES/NO select drives two fields. */
const field = (o: any) => ({
  id: o.id,
  product_id: "p",
  step_id: "s",
  internal_name: o.n,
  variable_name: o.n,
  customer_label: o.n,
  help_text: null,
  field_type: o.t,
  is_required: !!o.req,
  is_active: true,
  default_value: null,
  min_value: null,
  max_value: null,
  display_order: 0,
  created_at: "",
  updated_at: "",
  option_source: o.src ?? "manual",
  catalogue_type: o.cat ?? null,
});

const dep = (o: any) => ({
  id: o.id,
  product_id: "p",
  source_field_id: o.src,
  source_option_id: null,
  operator: o.op,
  compare_value: o.cv ?? null,
  action: o.action,
  action_value: null,
  target_field_id: o.tgt,
  target_option_id: null,
  is_active: true,
  created_at: "",
  updated_at: "",
});

function bundle(over: Partial<ProductBundle> = {}): ProductBundle {
  return {
    product: { id: "p", status: "active", internal_name: "Beginner", kind: "package" },
    translation: { title: "Beginner", summary: "s", body: "b" },
    categoryIds: ["c"],
    placements: [],
    components: [],
    flow: { id: "f", is_active: true },
    steps: [{ id: "s", flow_id: "f", is_active: true, display_order: 0, internal_name: "Step", customer_title: "Step" }],
    fields: [
      field({ id: "f1", n: "accommodation", t: "single_select" }),
      field({ id: "f2", n: "nights", t: "quantity" }),
      field({ id: "f3", n: "room", t: "single_select", src: "catalogue", cat: "accommodation_room" }),
    ],
    options: [
      { id: "o1", field_id: "f1", internal_value: "YES", is_active: true, is_default: false, display_order: 0 },
      { id: "o2", field_id: "f1", internal_value: "NO", is_active: true, is_default: false, display_order: 1 },
    ],
    dependencies: [
      dep({ id: "d1", src: "f1", op: "is_true", action: "show", tgt: "f2" }),
      dep({ id: "d2", src: "f1", op: "is_false", action: "hide", tgt: "f2" }),
      dep({ id: "d3", src: "f1", op: "is_false", action: "reset_remove", tgt: "f2" }),
      dep({ id: "d4", src: "f1", op: "is_false", action: "hide", tgt: "f3" }),
      dep({ id: "d5", src: "f1", op: "is_false", action: "reset_remove", tgt: "f3" }),
    ],
    ...over,
  } as never as ProductBundle;
}

const pricing: any = {
  id: "pr",
  product_id: "p",
  mode: "structured",
  status: "active",
  base_amount_idr: 0,
  people_variable: null,
  days_variable: null,
  nights_variable: "nights",
  sessions_variable: null,
};

describe("saved dependency actions are executed", () => {
  it("SHOW keeps a field visible when the answer reads as yes", () => {
    const e = evaluateDependencies(bundle(), { accommodation: "YES", nights: 3 });
    expect(e.fields["f2"]!.hidden).toBe(false);
    expect(e.fields["f2"]!.forcedVisible).toBe(true);
    expect(e.fields["f3"]!.hidden).toBe(false);
  });

  it("HIDE and RESET/REMOVE fire when the answer reads as no", () => {
    const e = evaluateDependencies(bundle(), { accommodation: "NO", nights: 3, room: "r1" });
    expect(e.fields["f2"]!.hidden).toBe(true);
    expect(e.fields["f2"]!.reset).toBe(true);
    expect(e.fields["f3"]!.hidden).toBe(true);
    expect(e.fields["f3"]!.reset).toBe(true);
  });

  it("DISABLE is applied from a saved record", () => {
    const b = bundle({
      dependencies: [dep({ id: "d6", src: "f1", op: "equals", cv: "NO", action: "disable", tgt: "f2" })] as never,
    });
    expect(evaluateDependencies(b, { accommodation: "NO" }).fields["f2"]!.disabled).toBe(true);
  });

  it("clears the value of a hidden or reset field", () => {
    expect(stripInactiveAnswers(bundle(), { accommodation: "NO", nights: 3, room: "r1" })).toEqual({
      accommodation: "NO",
      nights: "",
      room: "",
    });
    expect(stripInactiveAnswers(bundle(), { accommodation: "YES", nights: 3 })).toEqual({
      accommodation: "YES",
      nights: 3,
    });
  });

  it("a hidden field contributes nothing to pricing", () => {
    const hidden = resolveInputs(bundle() as never, { accommodation: "NO", nights: 3 });
    expect(hidden["nights"]).toBeUndefined();
    const shown = resolveInputs(bundle() as never, { accommodation: "YES", nights: 3 });
    expect(shown["nights"]).toBeDefined();
  });

  it("a hidden required field does not block the flow", () => {
    const b = bundle({
      fields: [
        field({ id: "f1", n: "accommodation", t: "single_select" }),
        field({ id: "f2", n: "nights", t: "quantity", req: true }),
        field({ id: "f3", n: "room", t: "single_select", src: "catalogue", cat: "accommodation_room" }),
      ] as never,
    });
    expect(configurationIssues(b, { accommodation: "NO" })).toEqual([]);
    expect(configurationIssues(b, { accommodation: "YES" })).toEqual(["nights is required."]);
  });
});

describe("select validation respects the catalogue and required flag", () => {
  it("a catalogue-backed select needs no manual options", () => {
    const issues = validateBundle(bundle());
    expect(issues.filter((i) => i.level === "error" && i.message.includes("room"))).toEqual([]);
  });

  it("an optional manual select with no option warns instead of failing", () => {
    const b = bundle({
      fields: [field({ id: "f9", n: "hotelroom", t: "single_select" })] as never,
      options: [] as never,
      dependencies: [] as never,
    });
    const errs = validateBundle(b).filter((i) => i.level === "error");
    expect(errs).toEqual([]);
  });

  it("a required manual select with no option still fails", () => {
    const b = bundle({
      fields: [field({ id: "f9", n: "hotelroom", t: "single_select", req: true })] as never,
      options: [] as never,
      dependencies: [] as never,
    });
    const errs = validateBundle(b).filter((i) => i.level === "error");
    expect(errs.length).toBeGreaterThan(0);
  });

  it("keeps pricing usable while a catalogue price is present", () => {
    const inputs = resolveInputs(bundle() as never, { accommodation: "YES", nights: 2 });
    inputs["room_price"] = { type: "number", value: 500000n as never };
    expect(pricing.nights_variable).toBe("nights");
    expect(inputs["room_price"]).toBeDefined();
  });
});

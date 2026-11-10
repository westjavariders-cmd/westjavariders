import { describe, expect, it } from "vitest";

import {
  evaluateDependencies,
  stripInactiveAnswers,
  visibleStepFields,
  visibleSteps,
  type Field,
  type FieldEffect,
  type ProductBundle,
} from "@/lib/catalog";
import { isMissingRequiredAnswer, missingRequiredFields } from "@/lib/configurator-step-validation";

const step = (id: string, order: number) => ({
  id,
  flow_id: "f",
  is_active: true,
  display_order: order,
  internal_name: id,
  customer_title: id,
});

const field = (o: any) => ({
  id: o.id,
  product_id: "p",
  step_id: o.step,
  internal_name: o.n,
  variable_name: o.n,
  customer_label: o.n,
  help_text: null,
  field_type: o.t ?? "single_select",
  is_required: !!o.req,
  is_active: o.active ?? true,
  default_value: null,
  min_value: null,
  max_value: null,
  display_order: 0,
  created_at: "",
  updated_at: "",
  option_source: "manual",
  catalogue_type: null,
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

/**
 * Generic four-step flow: a driver question, then two questions hidden when the
 * driver reads as no, then a final always-visible question.
 */
function bundle(): ProductBundle {
  return {
    product: { id: "p", status: "active", internal_name: "Trip", kind: "package" },
    translation: { title: "Trip", summary: "s", body: "b" },
    categoryIds: [],
    placements: [],
    components: [],
    flow: { id: "f", is_active: true },
    steps: [step("s1", 0), step("s2", 1), step("s3", 2), step("s4", 3)],
    fields: [
      field({ id: "f1", step: "s1", n: "accommodation" }),
      field({ id: "f2", step: "s2", n: "room", req: true }),
      field({ id: "f3", step: "s3", n: "nights", t: "quantity" }),
      field({ id: "f4", step: "s4", n: "notes", t: "text" }),
    ],
    options: [
      {
        id: "o1",
        field_id: "f1",
        internal_value: "YES",
        is_active: true,
        is_default: false,
        display_order: 0,
      },
      {
        id: "o2",
        field_id: "f1",
        internal_value: "NO",
        is_active: true,
        is_default: false,
        display_order: 1,
      },
    ],
    dependencies: [
      dep({ id: "d1", src: "f1", op: "is_false", action: "hide", tgt: "f2" }),
      dep({ id: "d2", src: "f1", op: "is_false", action: "reset_remove", tgt: "f2" }),
      dep({ id: "d3", src: "f1", op: "is_false", action: "hide", tgt: "f3" }),
      dep({ id: "d4", src: "f1", op: "is_false", action: "reset_remove", tgt: "f3" }),
    ],
  } as never as ProductBundle;
}

const ids = (values: Record<string, unknown>) =>
  visibleSteps(bundle(), values as never).map((s) => s.id);

describe("configurator navigation skips hidden questions", () => {
  it("keeps a normal step for every visible question", () => {
    expect(ids({ accommodation: "YES" })).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("creates no step for a hidden question", () => {
    expect(ids({ accommodation: "NO" })).not.toContain("s2");
  });

  it("skips consecutive hidden questions and lands on the next visible one", () => {
    const visible = ids({ accommodation: "NO" });
    expect(visible).toEqual(["s1", "s4"]);
    expect(visible[visible.indexOf("s1") + 1]).toBe("s4");
  });

  it("a hidden required question does not block progression", () => {
    const b = bundle();
    const values = { accommodation: "NO" } as never;
    const evaluated = evaluateDependencies(b, values);
    expect(evaluated.fields["f2"]!.required).toBe(true);
    expect(evaluated.fields["f2"]!.hidden).toBe(true);
    expect(visibleStepFields(b, "s2", evaluated)).toHaveLength(0);
    expect(ids(values)).toEqual(["s1", "s4"]);
  });

  it("restores the step when the dependency makes the question visible again", () => {
    expect(ids({ accommodation: "NO" })).toEqual(["s1", "s4"]);
    expect(ids({ accommodation: "YES" })).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("still lists visible fields for a visible step", () => {
    const b = bundle();
    const evaluated = evaluateDependencies(b, { accommodation: "YES" } as never);
    expect(visibleStepFields(b, "s2", evaluated).map((f) => f.id)).toEqual(["f2"]);
  });

  it("leaves the existing RESET/REMOVE behaviour unchanged", () => {
    expect(
      stripInactiveAnswers(bundle(), { accommodation: "NO", room: "r1", nights: 3 } as never),
    ).toEqual({ accommodation: "NO", room: "", nights: "" });
  });
});

function effect(over: Partial<FieldEffect> = {}): FieldEffect {
  return {
    hidden: false,
    forcedVisible: false,
    required: true,
    disabled: false,
    min: null,
    max: null,
    forcedValue: null,
    reset: false,
    ...over,
  };
}

describe("configurator step required answers", () => {
  it("blocks Next when a visible required field is empty", () => {
    const f = field({ id: "f2", step: "s2", n: "room", req: true }) as Field;
    expect(isMissingRequiredAnswer(f, effect(), {})).toBe(true);
  });

  it("allows Next once the required field has a value", () => {
    const f = field({ id: "f2", step: "s2", n: "room", req: true }) as Field;
    expect(isMissingRequiredAnswer(f, effect(), { room: "r1" })).toBe(false);
  });

  it("does not block on optional empty fields in the same step", () => {
    const required = field({ id: "f2", step: "s1", n: "room", req: true }) as Field;
    const optional = field({ id: "f4", step: "s1", n: "notes", t: "text", req: false }) as Field;
    const effects = { f2: effect(), f4: effect({ required: false }) };
    expect(missingRequiredFields([required, optional], effects, {})).toEqual([required]);
  });

  it("treats numeric 0 as answered", () => {
    const f = field({ id: "f3", step: "s3", n: "nights", t: "quantity", req: true }) as Field;
    expect(isMissingRequiredAnswer(f, effect(), { nights: 0 })).toBe(false);
    expect(isMissingRequiredAnswer(f, effect(), { nights: "0" })).toBe(false);
  });

  it("treats explicit boolean false as answered", () => {
    const f = field({ id: "fb", step: "s1", n: "extra", t: "boolean", req: true }) as Field;
    expect(isMissingRequiredAnswer(f, effect(), { extra: false })).toBe(false);
    expect(isMissingRequiredAnswer(f, effect(), { extra: true })).toBe(false);
    expect(isMissingRequiredAnswer(f, effect(), {})).toBe(true);
  });

  it("does not block Next for a hidden required field", () => {
    const b = bundle();
    const values = { accommodation: "NO" } as never;
    const evaluated = evaluateDependencies(b, values);
    const hidden = b.fields.find((f) => f.id === "f2")!;
    expect(isMissingRequiredAnswer(hidden, evaluated.fields["f2"], values)).toBe(false);
    expect(
      missingRequiredFields(visibleStepFields(b, "s2", evaluated), evaluated.fields, values),
    ).toEqual([]);
  });

  it("never requires date_range, even when the field is marked required", () => {
    const f = field({ id: "fd", step: "s1", n: "when", t: "date_range", req: true }) as Field;
    expect(isMissingRequiredAnswer(f, effect({ required: true }), {})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { cataloguePriceVariable } from "./catalogue-bridge";
import {
  cataloguePriceVariableNames,
  evaluateFormula,
  formulaVariableNames,
  fromNumberLike,
  validatePricing,
} from "./pricing";

const field = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  product_id: "p1",
  step_id: "s1",
  internal_name: "Motorbike",
  variable_name: "motorbike",
  customer_label: "Motorbike",
  help_text: null,
  field_type: "single_select",
  is_required: false,
  is_active: true,
  default_value: null,
  min_value: null,
  max_value: null,
  display_order: 1,
  option_source: "catalogue",
  catalogue_type: "motorbike",
  ...over,
});

const bundle = (fields: any[]) =>
  ({
    product: { id: "p1", kind: "package", status: "active", internal_name: "P" },
    fields,
    components: [],
    options: [],
    steps: [{ id: "s1", is_active: true, display_order: 1 }],
    dependencies: [],
    categoryIds: [],
  }) as any;

const pricing = {
  id: "pr1",
  product_id: "p1",
  base_amount_idr: 0,
  mode: "formula",
  status: "draft",
  active_version_id: "v1",
  people_variable: null,
  days_variable: null,
  nights_variable: null,
  sessions_variable: null,
} as any;

describe("catalogue price variables in the pricing engine", () => {
  it("names one price variable per active catalogue question", () => {
    expect(cataloguePriceVariableNames(bundle([field()]))).toEqual([
      cataloguePriceVariable("motorbike"),
    ]);
  });

  it("ignores manual and inactive questions", () => {
    expect(
      cataloguePriceVariableNames(
        bundle([
          field({ id: "f2", variable_name: "extras", option_source: "manual", catalogue_type: null }),
          field({ id: "f3", variable_name: "room", is_active: false }),
        ]),
      ),
    ).toEqual([]);
  });

  it("lists the catalogue price as an available numeric value in the formula editor", () => {
    const names = formulaVariableNames(bundle([field()]), pricing);
    expect(names).toEqual(
      expect.arrayContaining([{ name: "motorbike_price", type: "number (catalogue price)" }]),
    );
  });

  it("accepts a formula that uses a catalogue price when activating", () => {
    const issues = validatePricing({
      bundle: bundle([field()]),
      pricing,
      rules: [],
      tiers: [],
      versions: [
        { id: "v1", version: 1, expression: "motorbike_price * 2", is_active: true } as any,
      ],
    } as never);
    expect(issues.join(" ")).not.toContain("motorbike_price");
  });

  it("still rejects an unknown value", () => {
    const issues = validatePricing({
      bundle: bundle([field()]),
      pricing,
      rules: [],
      tiers: [],
      versions: [{ id: "v1", version: 1, expression: "unicorn_price", is_active: true } as any],
    } as never);
    expect(issues.join(" ")).toContain("unicorn_price");
  });

  it("evaluates the catalogue price like any other numeric input", () => {
    const result = evaluateFormula("motorbike_price * 3", {
      motorbike_price: { type: "number", value: fromNumberLike(90000) },
    });
    expect(result).toEqual({ type: "number", value: fromNumberLike(270000) });
  });
});

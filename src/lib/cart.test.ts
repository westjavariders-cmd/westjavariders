import { describe, expect, it } from "vitest";

import { configurationIssues } from "@/lib/cart.server";
import type { ProductBundle } from "@/lib/catalog";

const field = (over: Partial<any> = {}): any => ({
  id: over.id ?? "f1",
  product_id: "p1",
  step_id: "s1",
  internal_name: "People",
  variable_name: "people",
  customer_label: "People",
  help_text: null,
  field_type: "quantity",
  is_required: true,
  is_active: true,
  default_value: null,
  min_value: 1,
  max_value: 4,
  display_order: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

const bundle = (fields: any[]): ProductBundle => ({
  product: { id: "p1", kind: "package", status: "active" } as never,
  translation: null,
  categoryIds: [],
  placements: [],
  components: [],
  flow: null,
  steps: [],
  fields,
  options: [],
  dependencies: [],
});

describe("package configuration validation", () => {
  it("reports a missing required answer", () => {
    expect(configurationIssues(bundle([field()]), {})).toEqual(["People is required."]);
  });

  it("accepts an answer inside the allowed range", () => {
    expect(configurationIssues(bundle([field()]), { people: 3 })).toEqual([]);
  });

  it("rejects an answer above the maximum", () => {
    expect(configurationIssues(bundle([field()]), { people: 9 })).toEqual([
      "People must be at most 4.",
    ]);
  });

  it("ignores inactive and info fields", () => {
    const fields = [
      field({ id: "f2", variable_name: "note", field_type: "info_block" }),
      field({ id: "f3", variable_name: "extra", is_active: false }),
    ];
    expect(configurationIssues(bundle(fields), {})).toEqual([]);
  });
});

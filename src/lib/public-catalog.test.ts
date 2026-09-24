import { describe, expect, it } from "vitest";

import { formatIdr, getPublicProductTitle, payableTotal, summarizeAnswers } from "@/lib/public-catalog";
import { initialValues } from "@/components/public/ConfiguratorForm";
import type { ProductBundle } from "@/lib/catalog";

const field = (over: Partial<any> = {}): any => ({
  id: "f1",
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
  min_value: null,
  max_value: null,
  display_order: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

const option = (over: Partial<any> = {}): any => ({
  id: "o1",
  field_id: "f2",
  internal_value: "beginner",
  customer_label: "Beginner",
  is_default: false,
  is_active: true,
  display_order: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

describe("public money display", () => {
  it("formats whole rupiah", () => {
    expect(formatIdr(1500000)).toBe("Rp 1,500,000");
  });
});

describe("getPublicProductTitle", () => {
  it("uses the editorial translation, not voucher_name", () => {
    expect(getPublicProductTitle("Cimaja Surf Trip", "cimaja-surf")).toBe("Cimaja Surf Trip");
  });

  it("falls back to internal_name when the translation title is empty", () => {
    expect(getPublicProductTitle("", "cimaja-surf")).toBe("cimaja-surf");
    expect(getPublicProductTitle("   ", "cimaja-surf")).toBe("cimaja-surf");
  });
});

describe("cart total", () => {
  it("counts only completed packages", () => {
    const total = payableTotal([
      { status: "complete", total_idr: 1000000 },
      { status: "complete", total_idr: 500000 },
      { status: "draft", total_idr: 900000 },
    ]);
    expect(total).toBe(1500000);
  });

  it("is zero with only a draft", () => {
    expect(payableTotal([{ status: "draft", total_idr: 900000 }])).toBe(0);
  });
});

describe("configuration summary", () => {
  it("uses customer labels and option labels", () => {
    const fields = [field(), field({ id: "f2", variable_name: "level", field_type: "single_select", customer_label: "Level" })];
    const lines = summarizeAnswers(fields, [option()], { people: 3, level: "beginner" });
    expect(lines).toEqual([
      { label: "People", value: "3" },
      { label: "Level", value: "Beginner" },
    ]);
  });

  it("skips empty, inactive and info fields", () => {
    const fields = [
      field(),
      field({ id: "f3", variable_name: "note", field_type: "info_block" }),
      field({ id: "f4", variable_name: "extra", is_active: false }),
    ];
    expect(summarizeAnswers(fields, [], { note: "hi", extra: "x" })).toEqual([]);
  });

  it("hides yes/no questions, keeping their quantities", () => {
    const fields = [
      field({ id: "f5", variable_name: "wantsbike", field_type: "boolean", customer_label: "Motorbike?" }),
      field({ id: "f6", variable_name: "wantsboard", field_type: "boolean", customer_label: "Board?" }),
    ];
    expect(
      summarizeAnswers(fields, [], { wantsbike: true, wantsbike_days: 3, wantsboard: false } as never),
    ).toEqual([{ label: "Days", value: "3" }]);
  });

  it("shows catalogue names and their quantities, never raw ids", () => {
    const id = "288bc324-a6fb-4723-90c4-2806478853f5";
    const other = "c1f780d5-bcb1-44df-84db-ac2561f14f53";
    const fields = [
      field({ id: "f7", variable_name: "lessons", field_type: "single_select", customer_label: "Lessons" }),
      field({ id: "f8", variable_name: "drone", field_type: "single_select", customer_label: "Drone" }),
    ];
    const lines = summarizeAnswers(
      fields,
      [],
      { lessons: id, lessons_people: 2, lessons_hours: 3, drone: other } as never,
      { [id]: "Price per people" },
    );
    expect(lines).toEqual([
      { label: "Lessons", value: "Price per people" },
      { label: "People", value: "2" },
      { label: "Hours", value: "3" },
    ]);
  });

  it("uses each catalogue's configured names for people and hours", () => {
    const id = "288bc324-a6fb-4723-90c4-2806478853f5";
    const lessonId = "c1f780d5-bcb1-44df-84db-ac2561f14f53";
    const fields = [
      field({ id: "f7", variable_name: "board", field_type: "single_select", customer_label: "Board" }),
      field({ id: "f8", variable_name: "lesson", field_type: "single_select", customer_label: "Lesson" }),
    ];
    expect(
      summarizeAnswers(
        fields,
        [],
        {
          board: id,
          board_people: 2,
          board_hours: 5,
          lesson: lessonId,
          lesson_people: 1,
          lesson_hours: 3,
        } as never,
        { [id]: "Fiber board", [lessonId]: "Surf lesson" },
        {
          board: { _people: "Number of boards", _hours: "Number of days" },
          lesson: { _people: "Number of surfers", _hours: "Number of sessions" },
        },
      ),
    ).toEqual([
      { label: "Board", value: "Fiber board" },
      { label: "Number of boards", value: "2" },
      { label: "Number of days", value: "5" },
      { label: "Lesson", value: "Surf lesson" },
      { label: "Number of surfers", value: "1" },
      { label: "Number of sessions", value: "3" },
    ]);
  });

  it("uses the configurator Customer-facing title when provided", () => {
    const fields = [
      field({ id: "f2", variable_name: "level", field_type: "single_select", customer_label: "Level" }),
    ];
    expect(
      summarizeAnswers(fields, [option()], { level: "beginner" }, {}, {}, {
        questionTitles: { f2: "What is your surf level?" },
      }),
    ).toEqual([{ label: "What is your surf level?", value: "Beginner" }]);
  });

});

describe("configurator defaults", () => {
  const bundle = (fields: any[], options: any[]): ProductBundle => ({
    product: { id: "p1", kind: "package", status: "active" } as never,
    translation: null,
    categoryIds: [],
    placements: [],
    components: [],
    flow: null,
    steps: [],
    fields,
    options,
    dependencies: [],
  });

  it("applies saved defaults from the product configuration", () => {
    const values = initialValues(
      bundle(
        [field({ id: "f2", variable_name: "level", field_type: "single_select" })],
        [option({ is_default: true })],
      ),
      null,
    );
    expect(values.level).toBe("beginner");
  });

  it("prefers a recovered draft answer over the default", () => {
    const values = initialValues(
      bundle(
        [field({ id: "f2", variable_name: "level", field_type: "single_select" })],
        [option({ is_default: true })],
      ),
      { level: "advanced" },
    );
    expect(values.level).toBe("advanced");
  });
});

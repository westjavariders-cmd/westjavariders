import { describe, expect, it } from "vitest";

import {
  generateTripCode,
  normalizeTripCode,
  parseSavedTripLines,
  toSavedTripLine,
} from "@/lib/saved-trip";

describe("trip share codes", () => {
  it("uses the CBR- prefix and an unambiguous alphabet", () => {
    const code = generateTripCode(() => 0);
    expect(code).toBe("CBR-AAAAA");
    expect(normalizeTripCode(code)).toBe(code);
  });

  it("accepts what a customer may paste", () => {
    expect(normalizeTripCode(" cbr-x7k4p ")).toBe("CBR-X7K4P");
    expect(normalizeTripCode("x7k4p")).toBe("CBR-X7K4P");
    expect(normalizeTripCode("CBR-X7K4")).toBeNull();
    expect(normalizeTripCode("CBR-X7K40")).toBeNull();
  });
});

describe("saved trip lines", () => {
  it("stores configuration references only", () => {
    const line = toSavedTripLine({
      line_kind: "package",
      product_id: "p1",
      answers: { people: 4 },
      season_month: 7,
      promo_code: "SUMMER",
      catalogue_id: null,
      catalogue_item_id: null,
    });
    expect(line).toEqual({
      kind: "package",
      product_id: "p1",
      answers: { people: 4 },
      season_month: 7,
      promo_code: "SUMMER",
    });
  });

  it("keeps direct catalogue bookings as catalogue references", () => {
    expect(
      toSavedTripLine({
        line_kind: "catalogue_item",
        product_id: null,
        catalogue_id: "c1",
        catalogue_item_id: "i1",
        answers: { nights: 3 },
      }),
    ).toEqual({
      kind: "catalogue_item",
      catalogue_id: "c1",
      catalogue_item_id: "i1",
      answers: { nights: 3 },
    });
  });

  it("ignores lines it cannot rebuild", () => {
    expect(toSavedTripLine({ line_kind: "package", product_id: null })).toBeNull();
    expect(toSavedTripLine({ line_kind: "catalogue_item", catalogue_id: "c1" })).toBeNull();
  });

  it("reads stored JSON defensively", () => {
    expect(parseSavedTripLines(null)).toEqual([]);
    expect(parseSavedTripLines([{ kind: "unknown" }, "x", null])).toEqual([]);
    expect(
      parseSavedTripLines([{ kind: "package", product_id: "p1" }]),
    ).toEqual([{ kind: "package", product_id: "p1", answers: {}, season_month: null, promo_code: null }]);
  });
});

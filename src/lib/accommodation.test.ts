import { describe, expect, it } from "vitest";

import {
  isRoomSelectable,
  moveItem,
  nightsSubtotalIdr,
  parseIdr,
  roomMargin,
  validateAccommodation,
  validateRoom,
} from "./accommodation";

const room = {
  internal_name: "Twin room",
  max_guests: 2,
  supplier_cost_per_night_idr: 300_000,
  customer_price_per_night_idr: 450_000,
};

describe("accommodation validation", () => {
  it("accepts a valid accommodation", () => {
    expect(validateAccommodation({ internal_name: "Villa", accommodation_type: "hotel" })).toEqual([]);
    expect(
      validateAccommodation({ internal_name: "Beach", accommodation_type: "beach_camping" }),
    ).toEqual([]);
  });

  it("rejects an empty name and an invalid type", () => {
    expect(validateAccommodation({ internal_name: "  ", accommodation_type: "hotel" })).toHaveLength(1);
    expect(validateAccommodation({ internal_name: "Villa", accommodation_type: "hostel" })).toHaveLength(
      1,
    );
  });

  it("accepts a valid room and a zero customer price", () => {
    expect(validateRoom(room)).toEqual([]);
    expect(validateRoom({ ...room, customer_price_per_night_idr: 0 })).toEqual([]);
  });

  it("rejects negative money and negative guests", () => {
    expect(validateRoom({ ...room, supplier_cost_per_night_idr: -1 })).toHaveLength(1);
    expect(validateRoom({ ...room, customer_price_per_night_idr: -1 })).toHaveLength(1);
    expect(validateRoom({ ...room, max_guests: -1 })).toHaveLength(1);
  });

  it("rejects fractional rupiah", () => {
    expect(validateRoom({ ...room, customer_price_per_night_idr: 450_000.5 })).toHaveLength(1);
  });
});

describe("money helpers", () => {
  it("parses whole rupiah and rejects decimals", () => {
    expect(parseIdr("450.000")).toBe(450_000);
    expect(parseIdr("")).toBe(0);
    expect(parseIdr("45x")).toBeNull();
  });

  it("computes informational margin", () => {
    expect(roomMargin(300_000, 450_000)).toEqual({
      amount: 150_000,
      percentage: (150_000 / 450_000) * 100,
    });
    expect(roomMargin(0, 0)).toEqual({ amount: 0, percentage: 0 });
  });

  it("multiplies camping price by nights", () => {
    expect(nightsSubtotalIdr(250_000, 3)).toBe(750_000);
    expect(nightsSubtotalIdr(250_000, 0)).toBe(0);
    expect(nightsSubtotalIdr(250_000, -1)).toBeNull();
  });
});

describe("selectability and ordering", () => {
  it("blocks rooms of an inactive accommodation", () => {
    expect(isRoomSelectable({ active: true }, { active: true })).toBe(true);
    expect(isRoomSelectable({ active: false }, { active: true })).toBe(false);
    expect(isRoomSelectable({ active: true }, { active: false })).toBe(false);
  });

  it("reorders items within bounds", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});

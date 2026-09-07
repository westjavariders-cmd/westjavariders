import { describe, expect, it } from "vitest";

import {
  moveItem,
  otherLocationQuote,
  parseIdr,
  transportMargin,
  validatePeoplePrices,
  validateTimePrices,
  validateTransport,
} from "@/lib/transport";

describe("transport validation", () => {
  it("requires a name and a valid type", () => {
    expect(validateTransport({ internal_name: "Jakarta - Cimaja", transport_type: "predefined_route" })).toEqual([]);
    expect(validateTransport({ internal_name: " ", transport_type: "predefined_route" })).toHaveLength(1);
    expect(validateTransport({ internal_name: "X", transport_type: "boat" })).toHaveLength(1);
  });

  it("keeps travel hours inside 1-9 and in order", () => {
    expect(
      validateTransport({
        internal_name: "Other",
        transport_type: "other_location",
        min_travel_hours: 1,
        max_travel_hours: 9,
      }),
    ).toEqual([]);
    expect(
      validateTransport({
        internal_name: "Other",
        transport_type: "other_location",
        min_travel_hours: 0,
        max_travel_hours: 10,
      }),
    ).toHaveLength(2);
    expect(
      validateTransport({
        internal_name: "Other",
        transport_type: "other_location",
        min_travel_hours: 5,
        max_travel_hours: 3,
      }),
    ).toHaveLength(1);
  });

  it("rejects invalid people prices and duplicates, and accepts zero", () => {
    expect(
      validatePeoplePrices([
        { people: 1, supplier_cost_idr: 0, customer_price_idr: 0 },
        { people: 2, supplier_cost_idr: 500000, customer_price_idr: 750000 },
      ]),
    ).toEqual([]);
    expect(validatePeoplePrices([{ people: 5, supplier_cost_idr: 0, customer_price_idr: 0 }])).toHaveLength(1);
    expect(
      validatePeoplePrices([
        { people: 2, supplier_cost_idr: 0, customer_price_idr: 0 },
        { people: 2, supplier_cost_idr: 0, customer_price_idr: 0 },
      ]),
    ).toHaveLength(1);
    expect(validatePeoplePrices([{ people: 1, supplier_cost_idr: -1, customer_price_idr: 0 }])).toHaveLength(1);
    expect(validatePeoplePrices([{ people: 1, supplier_cost_idr: 0, customer_price_idr: 1000.5 }])).toHaveLength(1);
  });

  it("rejects invalid or duplicate travel-hour prices", () => {
    expect(validateTimePrices([{ travel_hours: 9, supplier_cost_idr: 0, customer_price_idr: 0 }])).toEqual([]);
    expect(validateTimePrices([{ travel_hours: 10, supplier_cost_idr: 0, customer_price_idr: 0 }])).toHaveLength(1);
    expect(
      validateTimePrices([
        { travel_hours: 3, supplier_cost_idr: 0, customer_price_idr: 0 },
        { travel_hours: 3, supplier_cost_idr: 0, customer_price_idr: 0 },
      ]),
    ).toHaveLength(1);
  });
});

describe("transport money", () => {
  it("parses whole Rupiah only", () => {
    expect(parseIdr("1.500.000")).toBe(1500000);
    expect(parseIdr("")).toBe(0);
    expect(parseIdr("1500,50")).toBe(150050);
    expect(parseIdr("abc")).toBeNull();
  });

  it("reports informational margin", () => {
    expect(transportMargin(300000, 450000)).toEqual({ amount: 150000, percentage: (150000 / 450000) * 100 });
    expect(transportMargin(0, 0)).toEqual({ amount: 0, percentage: 0 });
  });
});

describe("other location calculator", () => {
  it("adds the time price and the people price exactly", () => {
    const quote = otherLocationQuote({
      timePrice: { supplier_cost_idr: 400000, customer_price_idr: 600000 },
      peoplePrice: { supplier_cost_idr: 100000, customer_price_idr: 200000 },
    });
    expect(quote).toEqual({
      timeCustomerIdr: 600000,
      peopleCustomerIdr: 200000,
      finalPriceIdr: 800000,
      internalCostIdr: 500000,
      amount: 300000,
      percentage: (300000 / 800000) * 100,
    });
  });

  it("returns nothing when a price is missing", () => {
    expect(
      otherLocationQuote({
        timePrice: undefined,
        peoplePrice: { supplier_cost_idr: 0, customer_price_idr: 0 },
      }),
    ).toBeNull();
  });
});

describe("ordering", () => {
  it("moves an item up and down", () => {
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });
});

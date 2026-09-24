import { describe, expect, it } from "vitest";

import {
  expandTransportPriceChoices,
  moveItem,
  otherLocationQuote,
  otherLocationQuoteMultiplied,
  parseIdr,
  publicTransportHourChoices,
  publicTransportPeopleChoices,
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

  it("keeps travel hours inside 1-30 and in order", () => {
    expect(
      validateTransport({
        internal_name: "Other",
        transport_type: "other_location",
        min_travel_hours: 1,
        max_travel_hours: 30,
      }),
    ).toEqual([]);
    expect(
      validateTransport({
        internal_name: "Other",
        transport_type: "other_location",
        min_travel_hours: 0,
        max_travel_hours: 31,
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
    expect(validatePeoplePrices([{ people: 11, supplier_cost_idr: 0, customer_price_idr: 0 }])).toHaveLength(1);
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
    expect(validateTimePrices([{ travel_hours: 30, supplier_cost_idr: 0, customer_price_idr: 0 }])).toEqual([]);
    expect(validateTimePrices([{ travel_hours: 31, supplier_cost_idr: 0, customer_price_idr: 0 }])).toHaveLength(1);
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

describe("otherLocationQuoteMultiplied", () => {
  it("multiplies the time price by the price of the selected people count", () => {
    const quote = otherLocationQuoteMultiplied({
      timePrice: { supplier_cost_idr: 100000, customer_price_idr: 200000 },
      peoplePrice: { supplier_cost_idr: 50000, customer_price_idr: 80000 },
    });
    expect(quote?.finalPriceIdr).toBe(16000000000);
    expect(quote?.internalCostIdr).toBe(5000000000);
    expect(quote?.peopleCustomerIdr).toBe(80000);
  });

  it("returns null when a price is missing", () => {
    expect(
      otherLocationQuoteMultiplied({
        timePrice: undefined,
        peoplePrice: { supplier_cost_idr: 1, customer_price_idr: 1 },
      }),
    ).toBeNull();
  });
});

describe("public transport pickers", () => {
  it("opens an identity 1–7 people table to 1–10 with 8→8", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((value) => ({ value, price_idr: value }));
    const people = publicTransportPeopleChoices(rows);
    expect(people.map((r) => r.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(people[7]).toEqual({ value: 8, price_idr: 8 });
    expect(people[9]).toEqual({ value: 10, price_idr: 10 });
  });

  it("does not invent people slots when prices are real Rupiah, not 1=1", () => {
    const rows = [1, 2, 3, 4].map((value) => ({ value, price_idr: value * 1000 }));
    expect(publicTransportPeopleChoices(rows).map((r) => r.value)).toEqual([1, 2, 3, 4]);
  });

  it("leaves a sparse people table unchanged", () => {
    expect(publicTransportPeopleChoices([{ value: 2, price_idr: 10 }])).toEqual([
      { value: 2, price_idr: 10 },
    ]);
  });

  it("opens an identity 1–14 hour table to 1–30 even when max travel time is still 14", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((value) => ({
      value,
      price_idr: value,
    }));
    const hours = publicTransportHourChoices(rows, 1, 14);
    expect(hours.map((r) => r.value)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(hours[14]).toEqual({ value: 15, price_idr: 15 });
    expect(hours[29]).toEqual({ value: 30, price_idr: 30 });
  });

  it("still respects a shorter max travel time", () => {
    const rows = [1, 2, 3, 4].map((value) => ({ value, price_idr: 1 }));
    expect(publicTransportHourChoices(rows, null, 3).map((r) => r.value)).toEqual([1, 2, 3]);
  });

  it("does not invent rows for an empty table", () => {
    expect(expandTransportPriceChoices([], 7, 10)).toEqual([]);
  });
});

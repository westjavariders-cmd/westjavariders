import { describe, expect, it } from "vitest";

import {
  convertIdrToCustomer,
  customerSplit,
  formatCustomerAmount,
  formatRate,
  parseRateMicros,
} from "@/lib/fx";

describe("fx rates", () => {
  it("parses admin rates exactly, to six decimals", () => {
    expect(formatRate(parseRateMicros("18000"))).toBe("18000");
    expect(formatRate(parseRateMicros("16,500.5"))).toBe("16500.5");
    expect(formatRate(parseRateMicros("0.000001"))).toBe("0.000001");
  });

  it("rejects invalid or non-positive rates", () => {
    expect(() => parseRateMicros("")).toThrow();
    expect(() => parseRateMicros("0")).toThrow();
    expect(() => parseRateMicros("-1")).toThrow();
    expect(() => parseRateMicros("abc")).toThrow();
    expect(() => parseRateMicros("1.1234567")).toThrow();
  });
});

describe("conversion", () => {
  const eur = parseRateMicros("18000");

  it("rounds up to a whole customer unit", () => {
    expect(convertIdrToCustomer(18000, eur)).toBe(1);
    expect(convertIdrToCustomer(18001, eur)).toBe(2);
    expect(convertIdrToCustomer(1, eur)).toBe(1);
    expect(convertIdrToCustomer(0, eur)).toBe(0);
  });

  it("is exact for large amounts", () => {
    expect(convertIdrToCustomer(45_000_000, eur)).toBe(2500);
    expect(convertIdrToCustomer(45_000_001, eur)).toBe(2501);
  });

  it("rejects non-integer or negative Rupiah amounts", () => {
    expect(() => convertIdrToCustomer(10.5, eur)).toThrow();
    expect(() => convertIdrToCustomer(-1, eur)).toThrow();
  });

  it("never converts with a missing rate", () => {
    expect(() => convertIdrToCustomer(1000, 0n)).toThrow();
  });
});

describe("deposit and balance in the customer currency", () => {
  const eur = parseRateMicros("18000");

  it("keeps deposit + balance equal to the converted total", () => {
    const split = customerSplit(45_000_001, 18_000_001, eur);
    expect(split.first_payment + split.outstanding).toBe(split.total);
  });

  it("handles a deposit of the whole amount", () => {
    const split = customerSplit(36_000_000, 36_000_000, eur);
    expect(split).toEqual({ total: 2000, first_payment: 2000, outstanding: 0 });
  });

  it("never lets the deposit exceed the total after rounding", () => {
    const split = customerSplit(1, 1, eur);
    expect(split.first_payment).toBeLessThanOrEqual(split.total);
    expect(split.outstanding).toBe(0);
  });
});

describe("display", () => {
  it("shows whole units with the symbol when known", () => {
    expect(formatCustomerAmount(2500, "EUR", "€")).toBe("€2,500");
    expect(formatCustomerAmount(2500, "EUR", null)).toBe("EUR 2,500");
  });
});

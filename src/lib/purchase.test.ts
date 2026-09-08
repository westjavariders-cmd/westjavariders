import { describe, expect, it } from "vitest";

import {
  balanceFor,
  depositFor,
  parseFirstPaymentPercentage,
  purchaseStatusFor,
} from "@/lib/purchase";

describe("first payment percentage", () => {
  it("reads the configured value", () => {
    expect(parseFirstPaymentPercentage("40")).toBe(40);
    expect(parseFirstPaymentPercentage("33.33")).toBe(33.33);
  });

  it("rejects a missing or impossible value", () => {
    expect(() => parseFirstPaymentPercentage(null)).toThrow();
    expect(() => parseFirstPaymentPercentage("-1")).toThrow();
    expect(() => parseFirstPaymentPercentage("101")).toThrow();
  });
});

describe("deposit rounding", () => {
  it("rounds half up to whole Rupiah", () => {
    expect(depositFor(1_000_000, 40)).toBe(400_000);
    expect(depositFor(1_000_001, 40)).toBe(400_000); // 400000.4
    expect(depositFor(1_000_003, 40)).toBe(400_001); // 400001.2
    expect(depositFor(125, 40)).toBe(50);
    expect(depositFor(1_234_567, 33.33)).toBe(411_481); // 411481.17...
  });

  it("keeps deposit + balance exactly equal to the total", () => {
    for (const total of [0, 1, 7, 999, 123_456, 9_999_999]) {
      for (const pct of [0, 12.5, 33.33, 40, 99.99, 100]) {
        const deposit = depositFor(total, pct);
        expect(deposit).toBeGreaterThanOrEqual(0);
        expect(deposit).toBeLessThanOrEqual(total);
        expect(deposit + balanceFor(total, deposit)).toBe(total);
        expect(Number.isInteger(deposit)).toBe(true);
      }
    }
  });

  it("supports the boundary percentages", () => {
    expect(depositFor(500_000, 100)).toBe(500_000);
    expect(balanceFor(500_000, depositFor(500_000, 100))).toBe(0);
    expect(depositFor(500_000, 0)).toBe(0);
  });

  it("rejects a non-integer or negative total", () => {
    expect(() => depositFor(10.5, 40)).toThrow();
    expect(() => depositFor(-1, 40)).toThrow();
  });
});

describe("purchase status", () => {
  it("derives from confirmed money only", () => {
    expect(purchaseStatusFor(1000, 0)).toBe("pending_payment");
    expect(purchaseStatusFor(1000, 400)).toBe("partially_paid");
    expect(purchaseStatusFor(1000, 1000)).toBe("paid");
    expect(purchaseStatusFor(1000, 1200)).toBe("paid");
  });
});

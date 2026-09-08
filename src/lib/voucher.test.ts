import { describe, expect, it } from "vitest";

import {
  GIFT_MESSAGE_MAX,
  addMonths,
  buildEntitlement,
  effectiveStatus,
  isVoucherCode,
  parseValidityMonths,
  redemptionCheck,
  validUntil,
  validateGift,
} from "@/lib/voucher";

const snapshot = {
  packages: [
    {
      product_title: "Surf camp",
      answers: { level: "Beginner", extras: ["Photos", "Transfer"] },
      resolved_inputs: { people: 2, sessions: 5 },
      // Internal values that must never reach the customer document.
      internal_cost: 1234,
      supplier_cost_idr: 999,
    },
  ],
  customer: { full_name: "Ana Rivera" },
};

describe("voucher numbering", () => {
  it("accepts only the CBR-YYYY-NNN shape", () => {
    expect(isVoucherCode("CBR-2026-001")).toBe(true);
    expect(isVoucherCode("CBR-2026-1")).toBe(false);
    expect(isVoucherCode("CB-2026-001")).toBe(false);
    expect(isVoucherCode(null)).toBe(false);
  });
});

describe("validity", () => {
  it("reads the configured validity and rejects bad values", () => {
    expect(parseValidityMonths("8")).toBe(8);
    expect(() => parseValidityMonths(null)).toThrow();
    expect(() => parseValidityMonths("0")).toThrow();
    expect(() => parseValidityMonths("1.5")).toThrow();
  });

  it("adds calendar months and clamps a shorter month", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z")).toString).toBeDefined();
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toContain("2026-02-28");
    expect(validUntil(new Date("2026-01-15T00:00:00Z"), 8).toISOString()).toContain("2026-09-15");
  });
});

describe("gift data", () => {
  it("ignores gift fields when it is not a gift", () => {
    expect(validateGift({ is_gift: false, gift_recipient_name: "X", gift_message: "Y" })).toEqual({
      is_gift: false,
      gift_recipient_name: null,
      gift_message: null,
    });
  });

  it("enforces the message limit", () => {
    expect(() =>
      validateGift({ is_gift: true, gift_message: "x".repeat(GIFT_MESSAGE_MAX + 1) }),
    ).toThrow();
    const ok = validateGift({ is_gift: true, gift_message: "x".repeat(GIFT_MESSAGE_MAX) });
    expect(ok.gift_message?.length).toBe(GIFT_MESSAGE_MAX);
  });
});

describe("entitlement", () => {
  const base = {
    snapshot,
    purchaseReference: "CBR-000123",
    purchaseCreatedAt: "2026-01-15T00:00:00Z",
    totalIdr: 5_000_000,
    paidIdr: 2_000_000,
    recipientName: "Marco",
    giftMessage: "Enjoy!",
  } as const;

  it("shows the price on a standard voucher and hides it on a gift", () => {
    expect(buildEntitlement({ ...base, voucherType: "STANDARD" }).total_idr).toBe(5_000_000);
    const gift = buildEntitlement({ ...base, voucherType: "GIFT" });
    expect(gift.total_idr).toBeNull();
    expect(gift.recipient_name).toBe("Marco");
  });

  it("never leaks internal costs and keeps customer-facing options", () => {
    const built = buildEntitlement({ ...base, voucherType: "STANDARD" });
    expect(JSON.stringify(built)).not.toContain("999");
    expect(JSON.stringify(built)).not.toContain("1234");
    expect(built.items[0]!.options.map((o) => o.label)).toContain("Level");
    expect(built.items[0]!.people).toBe(2);
    expect(built.payment_state).toBe("partially_paid");
  });
});

describe("redemption", () => {
  const voucher = {
    id: "v1",
    code: "CBR-2026-001",
    purchase_id: "p1",
    status: "ACTIVE" as const,
    valid_until: "2030-01-01T00:00:00Z",
  };

  it("allows a single use and refuses reuse, cancellation and expiry", () => {
    expect(redemptionCheck(voucher).ok).toBe(true);
    expect(redemptionCheck({ ...voucher, status: "USED" }).ok).toBe(false);
    expect(redemptionCheck({ ...voucher, status: "CANCELLED" }).ok).toBe(false);
    expect(redemptionCheck({ ...voucher, valid_until: "2020-01-01T00:00:00Z" }).ok).toBe(false);
    expect(redemptionCheck(null).ok).toBe(false);
  });

  it("refuses a voucher from another booking", () => {
    expect(redemptionCheck(voucher, { expectedPurchaseId: "other" }).ok).toBe(false);
  });

  it("reads an active voucher past its date as expired", () => {
    expect(effectiveStatus("ACTIVE", "2020-01-01T00:00:00Z")).toBe("EXPIRED");
    expect(effectiveStatus("ACTIVE", "2030-01-01T00:00:00Z")).toBe("ACTIVE");
    expect(effectiveStatus("USED", "2020-01-01T00:00:00Z")).toBe("USED");
  });
});

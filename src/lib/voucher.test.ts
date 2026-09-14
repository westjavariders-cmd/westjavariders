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
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 2).toISOString()).toContain("2026-05-15");
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

  it("shows the package name, base price, partial amounts and total", () => {
    const detailed = {
      packages: [
        {
          package_id: "pk1",
          product_title: "Beginners week",
          option_labels: [{ label: "Choose your level", value: "Beginner" }],
          quote_lines: [
            { source: "base", label: "Base", amount_idr: 1_000_000 },
            { source: "rule", label: "Extra day", amount_idr: 500_000 },
            { source: "rule", label: "Nothing", amount_idr: 0 },
          ],
          base_price_idr: 1_000_000,
          total_idr: 1_500_000,
        },
      ],
      customer: { full_name: "Ana Rivera" },
    };
    const built = buildEntitlement({ ...base, snapshot: detailed, voucherType: "STANDARD" });
    const item = built.items[0]!;
    expect(built.package_title).toBe("Beginners week");
    expect(item.options).toEqual([{ label: "Choose your level", value: "Beginner" }]);
    expect(item.base_price_idr).toBe(1_000_000);
    expect(item.breakdown).toEqual([{ label: "Extra day", amount_idr: 500_000 }]);
    expect(item.total_idr).toBe(1_500_000);

    const gift = buildEntitlement({ ...base, snapshot: detailed, voucherType: "GIFT" });
    expect(gift.items[0]!.base_price_idr).toBeNull();
    expect(gift.items[0]!.breakdown).toEqual([]);
    expect(gift.items[0]!.total_idr).toBeNull();
  });

  it("rebuilds readable choices for older snapshots without saved labels", () => {
    const id = "288bc324-a6fb-4723-90c4-2806478853f5";
    const legacy = {
      packages: [
        {
          package_id: "pk1",
          product_title: "Beginners week",
          answers: {
            lessonsyesno: true,
            motorbikeyesno: false,
            choosemotorbike: "",
            softboard: [],
            surflessonscatalogueprice: id,
            surflessonscatalogueprice_hours: "2",
            surflessonscatalogueprice_people: "1",
          },
          catalogue_selections: [{ item_id: id, name: "Price per people" }],
          total_idr: 600_000,
        },
      ],
      customer: { full_name: "Ana Rivera" },
    };
    const built = buildEntitlement({ ...base, snapshot: legacy, voucherType: "STANDARD" });
    const options = built.items[0]!.options;
    expect(options).toEqual([
      { label: "Lessonsyesno", value: "Yes" },
      { label: "Surflessonscatalogueprice", value: "Price per people" },
      { label: "People", value: "1" },
      { label: "Hours", value: "2" },
    ]);
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

/* ------------------------------------------------------------------ */
/* One voucher per purchased Package                                   */
/* ------------------------------------------------------------------ */

describe("one voucher per package", () => {
  const snapshotOf = (n: number) => ({
    customer: { full_name: "Ana Rivera" },
    packages: Array.from({ length: n }, (_, i) => ({
      package_id: `pkg-${i + 1}`,
      product_title: `Experience ${i + 1}`,
      answers: { level: "Beginner" },
      resolved_inputs: { people: 2 },
      total_idr: (i + 1) * 1_000_000,
    })),
  });

  /** The issuance loop under test: one voucher per snapshot package, keyed by package. */
  function issue(snapshot: any, store: Map<string, any> = new Map()) {
    for (const pkg of snapshot.packages) {
      if (store.has(pkg.package_id)) continue; // database uniqueness on package_id
      store.set(pkg.package_id, {
        purchase_id: "purchase-1",
        package_id: pkg.package_id,
        entitlement: buildEntitlement({
          snapshot,
          voucherType: "STANDARD",
          purchaseReference: "CBR-000123",
          purchaseCreatedAt: "2026-01-15T00:00:00Z",
          packageId: pkg.package_id,
          totalIdr: 6_000_000,
          paidIdr: 2_400_000,
          recipientName: null,
          giftMessage: null,
        }),
      });
    }
    return store;
  }

  it("issues exactly one voucher for one package", () => {
    expect(issue(snapshotOf(1)).size).toBe(1);
  });

  it("issues two vouchers for two packages", () => {
    expect(issue(snapshotOf(2)).size).toBe(2);
  });

  it("issues three vouchers for three packages", () => {
    expect(issue(snapshotOf(3)).size).toBe(3);
  });

  it("never duplicates a voucher when payment confirmation is replayed", () => {
    const snapshot = snapshotOf(3);
    const store = issue(snapshot);
    issue(snapshot, store);
    issue(snapshot, store);
    expect(store.size).toBe(3);
  });

  it("references the correct package and the same purchase", () => {
    const store = issue(snapshotOf(3));
    for (const [id, v] of store) {
      expect(v.package_id).toBe(id);
      expect(v.entitlement.package_id).toBe(id);
      expect(v.entitlement.items).toHaveLength(1);
      expect(v.entitlement.items[0].product_title).toBe(
        `Experience ${id.replace("pkg-", "")}`,
      );
      expect(v.purchase_id).toBe("purchase-1");
    }
  });

  it("prices the package on a standard voucher and hides it on a gift", () => {
    const snapshot = snapshotOf(2);
    const std = buildEntitlement({
      snapshot,
      voucherType: "STANDARD",
      purchaseReference: "CBR-000123",
      purchaseCreatedAt: "2026-01-15T00:00:00Z",
      packageId: "pkg-2",
      totalIdr: 3_000_000,
      paidIdr: 3_000_000,
      recipientName: null,
      giftMessage: null,
    });
    expect(std.total_idr).toBe(2_000_000);
    expect(std.package_title).toBe("Experience 2");

    const gift = buildEntitlement({
      snapshot,
      voucherType: "GIFT",
      purchaseReference: "CBR-000123",
      purchaseCreatedAt: "2026-01-15T00:00:00Z",
      packageId: "pkg-2",
      totalIdr: 3_000_000,
      paidIdr: 3_000_000,
      recipientName: "Marco",
      giftMessage: "Enjoy!",
    });
    expect(gift.total_idr).toBeNull();
    expect(gift.recipient_name).toBe("Marco");
    expect(gift.package_id).toBe("pkg-2");
  });

  it("keeps used and cancelled behaviour per voucher", () => {
    const base = {
      id: "v1",
      code: "CBR-2026-002",
      purchase_id: "purchase-1",
      status: "ACTIVE" as const,
      valid_until: "2030-01-01T00:00:00Z",
    };
    expect(redemptionCheck(base).ok).toBe(true);
    expect(redemptionCheck({ ...base, status: "USED" }).ok).toBe(false);
    expect(redemptionCheck({ ...base, status: "CANCELLED" }).ok).toBe(false);
  });
});

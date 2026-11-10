import { describe, expect, it } from "vitest";

import { buildEntitlement } from "@/lib/voucher";
import { buildDocumentModel, DEFAULT_BUSINESS_NAME, readContactSettings } from "@/lib/voucher-delivery";
import { renderVoucherPdf } from "@/lib/voucher-pdf.server";
import { sendEmail } from "@/lib/email.server";

const check = readContactSettings([
  { key: "business_name", value: DEFAULT_BUSINESS_NAME },
  { key: "contact_email", value: "reservations@cimaja.example" },
  { key: "contact_whatsapp", value: "+62 811 111 222" },
  { key: "contact_location", value: "Cimaja, West Java" },
]);
if (!check.ok) throw new Error("contact settings fixture is incomplete");
const contact = check.contact;

const snapshot = {
  customer: { full_name: "Ana Lopez" },
  packages: [
    { package_id: "pkg-a", product_title: "Surf Camp 5 Days", total_idr: 5_000_000, answers: { people: 2 }, resolved_inputs: { people: 2 } },
    { package_id: "pkg-b", product_title: "Volcano Day Trip", total_idr: 1_200_000, answers: {}, resolved_inputs: {} },
  ],
};

function model(packageId: string, type: "STANDARD" | "GIFT", code: string) {
  return buildDocumentModel({
    voucher: {
      code,
      voucher_type: type,
      issued_at: "2026-09-08T00:00:00.000Z",
      valid_until: "2027-05-08T00:00:00.000Z",
      validity_months: 8,
      gift_recipient_name: type === "GIFT" ? "Budi" : null,
      gift_message: type === "GIFT" ? "Have fun" : null,
    },
    entitlement: buildEntitlement({
      snapshot,
      voucherType: type,
      purchaseReference: "CBR-000123",
      purchaseCreatedAt: "2026-09-01T00:00:00.000Z",
      packageId,
      totalIdr: 6_200_000,
      paidIdr: 6_200_000,
      recipientName: type === "GIFT" ? "Budi" : null,
      giftMessage: type === "GIFT" ? "Have fun" : null,
    }),
    contact,
  });
}

describe("voucher pdf", () => {
  it("renders one PDF per voucher", async () => {
    const bytes = await renderVoucherPdf(model("pkg-a", "STANDARD", "CBR-2026-001"));
    expect(bytes.length).toBeGreaterThan(800);
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
  });

  it("renders independent documents for a multi-package purchase", async () => {
    const [a, b] = await Promise.all([
      renderVoucherPdf(model("pkg-a", "STANDARD", "CBR-2026-001")),
      renderVoucherPdf(model("pkg-b", "STANDARD", "CBR-2026-002")),
    ]);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it("renders the gift document without commercial data", async () => {
    const gift = model("pkg-a", "GIFT", "CBR-2026-003");
    expect(gift.commercial).toHaveLength(0);
    const bytes = await renderVoucherPdf(gift);
    expect(bytes.length).toBeGreaterThan(800);
  });
});

describe("email boundary", () => {
  it("reports a missing provider instead of throwing", async () => {
    const result = await sendEmail({
      to: "ana@example.com",
      subject: "Voucher",
      html: "<p>Voucher</p>",
      text: "Voucher",
    });
    if (result.sent) {
      expect(result.provider).toBeTruthy();
    } else {
      expect(["not_configured", "provider_error"]).toContain(result.reason);
    }
  });

  it("refuses an invalid recipient", async () => {
    const result = await sendEmail({ to: "", subject: "x", html: "x", text: "x" });
    expect(result.sent).toBe(false);
    expect(result.sent === false && result.reason).toBe("invalid_recipient");
  });
});

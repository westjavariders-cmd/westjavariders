import { describe, expect, it } from "vitest";

import { buildEntitlement } from "@/lib/voucher";
import {
  buildDocumentModel,
  buildEmailContent,
  documentObjectPath,
  readContactSettings,
  resolveRecipients,
  templateFor,
} from "@/lib/voucher-delivery";

const CONTACT_ROWS = [
  { key: "business_name", value: "Cimaja Boardriders" },
  { key: "contact_email", value: "reservations@cimaja.example" },
  { key: "contact_whatsapp", value: "+62 811 111 222" },
  { key: "contact_location", value: "Cimaja, West Java" },
];

const contact = () => {
  const check = readContactSettings(CONTACT_ROWS);
  if (!check.ok) throw new Error("expected complete contact settings");
  return check.contact;
};

function snapshot() {
  return {
    customer: { full_name: "Ana Lopez", email: "ana@example.com" },
    packages: [
      {
        package_id: "pkg-a",
        product_title: "Surf Camp 5 Days",
        total_idr: 5_000_000,
        answers: { people: 2 },
        resolved_inputs: { people: 2, days: 5 },
      },
      {
        package_id: "pkg-b",
        product_title: "Volcano Day Trip",
        total_idr: 1_200_000,
        answers: { people: 2 },
        resolved_inputs: { people: 2 },
      },
    ],
  };
}

function voucherFor(packageId: string, type: "STANDARD" | "GIFT", code: string) {
  const entitlement = buildEntitlement({
    snapshot: snapshot(),
    voucherType: type,
    purchaseReference: "CBR-000123",
    purchaseCreatedAt: "2026-09-01T00:00:00.000Z",
    packageId,
    totalIdr: 6_200_000,
    paidIdr: 2_480_000,
    recipientName: type === "GIFT" ? "Budi" : null,
    giftMessage: type === "GIFT" ? "Enjoy the waves!" : null,
  });
  return {
    voucher: {
      code,
      voucher_type: type,
      issued_at: "2026-09-08T00:00:00.000Z",
      valid_until: "2027-05-08T00:00:00.000Z",
      validity_months: 8,
      gift_recipient_name: type === "GIFT" ? "Budi" : null,
      gift_message: type === "GIFT" ? "Enjoy the waves!" : null,
    },
    entitlement,
  };
}

describe("voucher document", () => {
  it("builds one document per voucher containing only its own package", () => {
    const a = voucherFor("pkg-a", "STANDARD", "CBR-2026-001");
    const b = voucherFor("pkg-b", "STANDARD", "CBR-2026-002");
    const modelA = buildDocumentModel({ ...a, contact: contact() });
    const modelB = buildDocumentModel({ ...b, contact: contact() });

    expect(modelA.experience.package_title).toBe("Surf Camp 5 Days");
    expect(modelA.experience.items).toHaveLength(1);
    expect(JSON.stringify(modelA)).not.toContain("Volcano");
    expect(modelB.experience.package_title).toBe("Volcano Day Trip");
    expect(JSON.stringify(modelB)).not.toContain("Surf Camp");
    expect(modelA.voucher_code).not.toBe(modelB.voucher_code);
  });

  it("preserves the historical commercial data of the standard voucher", () => {
    const model = buildDocumentModel({ ...voucherFor("pkg-a", "STANDARD", "CBR-2026-001"), contact: contact() });
    const flat = JSON.stringify(model);
    expect(flat).toContain("CBR-000123");
    expect(flat).toContain("5,000,000");
    expect(model.commercial.some((l) => l.value === "Deposit received")).toBe(true);
    expect(model.validity.some((l) => l.value.includes("Open date"))).toBe(true);
  });

  it("never shows price or payment information on a gift document", () => {
    const model = buildDocumentModel({ ...voucherFor("pkg-a", "GIFT", "CBR-2026-003"), contact: contact() });
    expect(model.commercial).toHaveLength(0);
    const flat = JSON.stringify(model);
    expect(flat).not.toContain("IDR");
    expect(flat).not.toContain("Deposit");
    expect(flat).not.toContain("CBR-000123");
    expect(model.gift?.recipient_name).toBe("Budi");
    expect(model.gift?.message).toBe("Enjoy the waves!");
  });

  it("uses the configured contact details and never hardcoded placeholders", () => {
    const model = buildDocumentModel({ ...voucherFor("pkg-a", "STANDARD", "CBR-2026-001"), contact: contact() });
    const flat = JSON.stringify(model);
    expect(flat).toContain("reservations@cimaja.example");
    expect(flat).not.toContain("hello@cimajaboardriders.com");
    expect(flat).not.toContain("+62 812 0000 0000");
  });

  it("blocks delivery while contact settings are incomplete", () => {
    const check = readContactSettings([{ key: "contact_email", value: "" }]);
    expect(check.ok).toBe(false);
    expect(check.ok === false && check.missing).toContain("contact_email");
    expect(check.ok === false && check.missing).toContain("contact_whatsapp");
  });

  it("keeps document paths unguessable from the voucher number", () => {
    const path = documentObjectPath("11111111-1111-1111-1111-111111111111", "abc123");
    expect(path).not.toContain("CBR-");
    expect(path.endsWith(".pdf")).toBe(true);
  });
});

describe("voucher email", () => {
  it("sends the standard email to the voucher user and copies the configured address", () => {
    const recipients = resolveRecipients({
      voucherType: "STANDARD",
      customerEmail: "ana@example.com",
      contactEmail: "reservations@cimaja.example",
    });
    expect(recipients.role).toBe("voucher_user");
    expect(recipients.to).toBe("ana@example.com");
    expect(recipients.cc).toEqual(["reservations@cimaja.example"]);
  });

  it("sends the gift email to the purchaser and copies the configured address", () => {
    const recipients = resolveRecipients({
      voucherType: "GIFT",
      customerEmail: "buyer@example.com",
      contactEmail: "reservations@cimaja.example",
    });
    expect(recipients.role).toBe("purchaser");
    expect(recipients.to).toBe("buyer@example.com");
    expect(recipients.cc).toEqual(["reservations@cimaja.example"]);
  });

  it("renders the two templates with voucher data and no gift pricing", () => {
    const standard = buildEmailContent({
      model: buildDocumentModel({ ...voucherFor("pkg-a", "STANDARD", "CBR-2026-001"), contact: contact() }),
      recipientName: "Ana Lopez",
      language: "id",
    });
    expect(standard.template).toBe("STANDARD_VOUCHER");
    expect(standard.language).toBe("en");
    expect(standard.subject).toContain("CBR-2026-001");
    expect(standard.text).toContain("5,000,000");

    const gift = buildEmailContent({
      model: buildDocumentModel({ ...voucherFor("pkg-a", "GIFT", "CBR-2026-003"), contact: contact() }),
      recipientName: "Ana Lopez",
      language: null,
    });
    expect(gift.template).toBe("GIFT_VOUCHER");
    expect(gift.text).not.toContain("IDR");
    expect(gift.text).toContain("Enjoy the waves!");
    expect(templateFor("GIFT")).toBe("GIFT_VOUCHER");
  });
});

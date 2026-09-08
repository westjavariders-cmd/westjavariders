import { describe, expect, it } from "vitest";

import {
  normaliseEmail,
  normalisePhone,
  validateCustomerContact,
  PURCHASE_FULFILLMENT_LABELS,
} from "@/lib/customer";

describe("customer contact validation", () => {
  it("accepts and normalises real contact details", () => {
    const contact = validateCustomerContact({
      full_name: "  Ana   Perez ",
      email: " ANA@Example.COM ",
      phone: " +62 812-3456-7890 ",
      country: " Spain ",
      preferred_language_code: "EN",
    });
    expect(contact).toEqual({
      full_name: "Ana Perez",
      email: "ana@example.com",
      phone: "+6281234567890",
      country: "Spain",
      preferred_language_code: "en",
    });
  });

  it("treats email as the conservative identity key", () => {
    expect(normaliseEmail(" Same@Mail.com ")).toBe(normaliseEmail("same@mail.com"));
    expect(normalisePhone("0812 345 678")).toBe("0812345678");
  });

  it("rejects invalid contact data", () => {
    const base = { full_name: "Ana Perez", email: "ana@example.com", phone: "+62812345678" };
    expect(() => validateCustomerContact({ ...base, full_name: "A" })).toThrow();
    expect(() => validateCustomerContact({ ...base, email: "not-an-email" })).toThrow();
    expect(() => validateCustomerContact({ ...base, email: "" })).toThrow();
    expect(() => validateCustomerContact({ ...base, phone: "12" })).toThrow();
    expect(() => validateCustomerContact({ ...base, phone: undefined })).toThrow();
    expect(() => validateCustomerContact({ ...base, preferred_language_code: "english!" })).toThrow();
  });

  it("keeps optional fields optional", () => {
    const contact = validateCustomerContact({
      full_name: "Ana Perez",
      email: "ana@example.com",
      phone: "+62812345678",
    });
    expect(contact.country).toBeNull();
    expect(contact.preferred_language_code).toBeNull();
  });
});

describe("operational status", () => {
  it("stays separate from commercial payment states", () => {
    expect(Object.keys(PURCHASE_FULFILLMENT_LABELS)).toEqual([
      "not_started",
      "in_progress",
      "completed",
    ]);
  });
});

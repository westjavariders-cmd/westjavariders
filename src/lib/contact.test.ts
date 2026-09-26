import { describe, expect, it } from "vitest";

import {
  composeContactEmail,
  isOverContactRate,
  WEBSITE_VISITOR_NAME,
} from "@/lib/contact";

describe("website contact email", () => {
  it("addresses the inbox without cart or voucher details", () => {
    const mail = composeContactEmail({
      source: "website",
      business: "Cimaja Boardriders",
      name: WEBSITE_VISITOR_NAME,
      email: "guest@example.com",
      phone: null,
      message: "Can we come next week?",
      voucherDetail: "should not appear",
      voucherCodes: ["CBR-1"],
    });
    expect(mail.subject).toBe("Website message from guest@example.com");
    expect(mail.text).toContain("guest@example.com");
    expect(mail.text).toContain("Can we come next week?");
    expect(mail.text).not.toContain("CBR-1");
    expect(mail.html).not.toContain("should not appear");
  });

  it("escapes HTML in the visitor message", () => {
    const mail = composeContactEmail({
      source: "website",
      business: "Cimaja",
      name: WEBSITE_VISITOR_NAME,
      email: "a@b.c",
      phone: null,
      message: "<script>alert(1)</script>",
      voucherDetail: "",
      voucherCodes: [],
    });
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
  });

  it("keeps cart copy when the enquiry is from checkout", () => {
    const mail = composeContactEmail({
      source: "cart",
      business: "Cimaja Boardriders",
      name: "Gon",
      email: "gon@example.com",
      phone: "+62",
      message: "Question",
      voucherDetail: "Voucher number: CBR-9",
      voucherCodes: ["CBR-9"],
    });
    expect(mail.subject).toBe("Customer question — CBR-9");
    expect(mail.text).toContain("Voucher number: CBR-9");
  });
});

describe("contact rate limit", () => {
  it("allows the first few messages and blocks the rest", () => {
    expect(isOverContactRate(0)).toBe(false);
    expect(isOverContactRate(4)).toBe(false);
    expect(isOverContactRate(5)).toBe(true);
  });
});

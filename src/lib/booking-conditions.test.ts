import { describe, expect, it } from "vitest";

import {
  BOOKING_CONDITIONS_MAX_CHARS,
  CART_CONDITIONS_ACCEPTANCE_LABEL,
  CART_GIFT_LABEL,
  bookingConditionsAreEmpty,
  sanitizeBookingConditions,
} from "@/lib/booking-conditions";

describe("booking conditions", () => {
  it("keeps the cart sentence customers tap", () => {
    expect(CART_CONDITIONS_ACCEPTANCE_LABEL).toContain("accepted the conditions");
    expect(CART_CONDITIONS_ACCEPTANCE_LABEL).toContain("surfing always comes with its own risks");
  });

  it("keeps newlines and caps length so Admin can paste the full terms", () => {
    const body = "Line one.\n\nLine two.";
    expect(sanitizeBookingConditions(body)).toBe(body);
    expect(sanitizeBookingConditions("x".repeat(BOOKING_CONDITIONS_MAX_CHARS + 50)).length).toBe(
      BOOKING_CONDITIONS_MAX_CHARS,
    );
  });

  it("treats blank copy as unpublished", () => {
    expect(bookingConditionsAreEmpty("  \n  ")).toBe(true);
    expect(bookingConditionsAreEmpty("Wear a leash.")).toBe(false);
  });

  it("keeps the gift checkbox label guests tap for the explanation", () => {
    expect(CART_GIFT_LABEL).toBe("This is a gift");
  });
});

import { describe, expect, it } from "vitest";

import { PRODUCT_MEDIA_BUCKET, productImagePath, productLandingImagePath, productStepImagePath } from "@/lib/catalog";

describe("product package image storage", () => {
  it("uses the private bucket and an unguessable path", () => {
    expect(PRODUCT_MEDIA_BUCKET).toBe("product-media");
    const id = "11111111-1111-1111-1111-111111111111";
    const a = productImagePath(id, "surf photo!.jpg");
    const b = productImagePath(id, "surf photo!.jpg");
    expect(a).not.toBe(b);
    expect(a.startsWith(`${id}/`)).toBe(true);
    expect(a).toMatch(/surf-photo-\.jpg$/);
  });

  it("keeps the landing photo on a distinct path", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const path = productLandingImagePath(id, "hero.jpg");
    expect(path.startsWith(`${id}/landing/`)).toBe(true);
    expect(path).not.toBe(productImagePath(id, "hero.jpg"));
  });

  it("keeps a step photo under the product and step ids", () => {
    const productId = "11111111-1111-1111-1111-111111111111";
    const stepId = "22222222-2222-2222-2222-222222222222";
    const path = productStepImagePath(productId, stepId, "room.jpg");
    expect(path.startsWith(`${productId}/steps/${stepId}/`)).toBe(true);
    expect(path).not.toBe(productImagePath(productId, "room.jpg"));
  });
});

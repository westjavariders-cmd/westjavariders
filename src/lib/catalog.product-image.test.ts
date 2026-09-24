import { describe, expect, it } from "vitest";

import { PRODUCT_MEDIA_BUCKET, productImagePath } from "@/lib/catalog";

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
});

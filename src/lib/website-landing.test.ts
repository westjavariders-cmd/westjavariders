import { describe, expect, it } from "vitest";

import { HOME_ROUTE, HOME_SLUG, resolveDestination } from "@/lib/website";

describe("entry / landing destinations", () => {
  it("sends the Home button to its own address, never back to the entrance", () => {
    const d = resolveDestination({ kind: "page", pageSlug: HOME_SLUG });
    expect(d).toEqual({ href: HOME_ROUTE, external: false });
    expect(d?.href).not.toBe("/");
  });

  it("keeps other pages on their own address", () => {
    expect(resolveDestination({ kind: "page", pageSlug: "explore-west-java" })).toEqual({
      href: "/pages/explore-west-java",
      external: false,
    });
  });

  it("returns nothing when the button has no usable target", () => {
    expect(resolveDestination({ kind: "page", pageSlug: null })).toBeNull();
    expect(resolveDestination({ kind: "external", externalUrl: "javascript:alert(1)" })).toBeNull();
    expect(resolveDestination({ kind: "product", productId: null })).toBeNull();
  });

  it("accepts a secure external link", () => {
    expect(resolveDestination({ kind: "external", externalUrl: "https://example.com" })).toEqual({
      href: "https://example.com",
      external: true,
    });
  });
});

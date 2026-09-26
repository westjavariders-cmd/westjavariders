import { describe, expect, it } from "vitest";

import {
  assignGroupKeys,
  isChromeImagePath,
  isLandingCtaImagePath,
  isSafeSlug,
  isSiteBackgroundPath,
  moveInOrder,
  pickTranslation,
  resolveDestination,
  slugify,
  visibleSorted,
} from "@/lib/website";

describe("website slugs", () => {
  it("accepts safe slugs only", () => {
    expect(isSafeSlug("explore-west-java")).toBe(true);
    expect(isSafeSlug("home")).toBe(true);
    expect(isSafeSlug("Explore West Java")).toBe(false);
    expect(isSafeSlug("../admin")).toBe(false);
    expect(isSafeSlug("double--hyphen")).toBe(false);
    expect(isSafeSlug("")).toBe(false);
  });

  it("derives a safe slug from a display title", () => {
    expect(slugify("Meet the Boardriders!")).toBe("meet-the-boardriders");
    expect(slugify("  Explore   West Java  ")).toBe("explore-west-java");
  });
});

describe("visibility and order", () => {
  const rows = [
    { id: "c", is_active: true, sort_order: 2 },
    { id: "a", is_active: true, sort_order: 0 },
    { id: "hidden", is_active: false, sort_order: 1 },
    { id: "b", is_active: true, sort_order: 1 },
  ];

  it("keeps only active rows, in configured order", () => {
    expect(visibleSorted(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("is stable when two rows share an order", () => {
    const tied = [
      { id: "first", is_active: true, sort_order: 0 },
      { id: "second", is_active: true, sort_order: 0 },
    ];
    expect(visibleSorted(tied).map((r) => r.id)).toEqual(["first", "second"]);
  });

  it("moves a row up and down, and refuses out-of-range moves", () => {
    const list = ["a", "b", "c"];
    expect(moveInOrder(list, 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveInOrder(list, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(list, 0, -1)).toBe(list);
    expect(moveInOrder(list, 2, 1)).toBe(list);
  });
});

describe("multilingual fallback", () => {
  const rows = [
    { language_code: "en", title: "Meet the Boardriders" },
    { language_code: "es", title: "Conoce a los Boardriders" },
  ];

  it("uses the requested language when present", () => {
    expect(pickTranslation(rows, "es", "en")?.title).toBe("Conoce a los Boardriders");
  });

  it("falls back to the default language when untranslated", () => {
    expect(pickTranslation(rows, "ja", "en")?.title).toBe("Meet the Boardriders");
  });

  it("returns nothing when neither exists", () => {
    expect(pickTranslation([], "ja", "en")).toBeNull();
  });
});

describe("destination resolution", () => {
  it("resolves the controlled internal destinations", () => {
    expect(resolveDestination({ kind: "build_your_trip" })).toEqual({
      href: "/pages/firstwaves",
      external: false,
    });
    expect(resolveDestination({ kind: "book_individually" })).toEqual({
      href: "/pages/book-individually",
      external: false,
    });
    expect(resolveDestination({ kind: "page", pageSlug: "explore-west-java" })).toEqual({
      href: "/pages/explore-west-java",
      external: false,
    });
    expect(resolveDestination({ kind: "page", pageSlug: "home" })).toEqual({
      href: "/home",
      external: false,
    });
  });

  it("sends a product destination to the existing product flow", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(resolveDestination({ kind: "product", productId: id })).toEqual({
      href: `/build-your-trip/${id}`,
      external: false,
    });
  });

  it("refuses unsafe or incomplete destinations", () => {
    expect(resolveDestination({ kind: "none" })).toBeNull();
    expect(resolveDestination({ kind: "page", pageSlug: null })).toBeNull();
    expect(resolveDestination({ kind: "page", pageSlug: "/admin" })).toBeNull();
    expect(resolveDestination({ kind: "product", productId: null })).toBeNull();
    expect(resolveDestination({ kind: "external", externalUrl: "javascript:alert(1)" })).toBeNull();
    expect(resolveDestination({ kind: "external", externalUrl: "http://insecure.test" })).toBeNull();
  });

  it("accepts an explicit secure external link", () => {
    expect(resolveDestination({ kind: "external", externalUrl: "https://example.com/x" })).toEqual({
      href: "https://example.com/x",
      external: true,
    });
  });
});

describe("chrome background storage paths", () => {
  it("only accepts files stored under the matching folder", () => {
    expect(isSiteBackgroundPath("site-background/123-cimaja.jpg")).toBe(true);
    expect(isChromeImagePath("header", "header-background/bar.jpg")).toBe(true);
    expect(isChromeImagePath("header", "site-background/123-cimaja.jpg")).toBe(false);
    expect(isChromeImagePath("menu", "menu-button/open.jpg")).toBe(true);
    expect(isChromeImagePath("menu", "header-background/bar.jpg")).toBe(false);
    expect(isSiteBackgroundPath("landing/image.jpg")).toBe(false);
    expect(isSiteBackgroundPath("../secret")).toBe(false);
  });

  it("accepts the entry-button photo only under landing/cta-", () => {
    expect(isLandingCtaImagePath("landing/cta-123-enter.jpg")).toBe(true);
    expect(isLandingCtaImagePath("landing/image-123.jpg")).toBe(false);
    expect(isLandingCtaImagePath("site-background/cta.jpg")).toBe(false);
  });
});

describe("catalogue group keys", () => {
  it("slugs the section title and disambiguates duplicates", () => {
    const keys = assignGroupKeys([
      { id: "a", title: "Surf lessons" },
      { id: "b", title: "Surf lessons" },
      { id: "c", title: "Transfers" },
    ]);
    expect(keys.get("a")).toBe("surf-lessons");
    expect(keys.get("b")).toBe("surf-lessons-2");
    expect(keys.get("c")).toBe("transfers");
  });

  it("slugs catalogue block titles the same way as sections", () => {
    const keys = assignGroupKeys([
      { id: "b1", title: "Beginner lessons" },
      { id: "b2", title: null },
    ]);
    expect(keys.get("b1")).toBe("beginner-lessons");
    expect(keys.get("b2")).toBe("b2");
  });
});

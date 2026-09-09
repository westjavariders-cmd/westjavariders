import { describe, expect, it } from "vitest";

import { configuredPageProducts, isPubliclyListable } from "@/lib/website";

const page = {
  sections: [
    {
      blocks: [
        { kind: "text", products: [] },
        {
          kind: "product_selection",
          products: [{ id: "cimaja", bookable: false }],
        },
      ],
    },
  ],
};

describe("Build Your Trip product selection", () => {
  it("returns the product explicitly referenced by an active product selection block", () => {
    expect(configuredPageProducts(page).map((p) => p.id)).toEqual(["cimaja"]);
  });

  it("adds nothing that the block does not reference", () => {
    expect(
      configuredPageProducts({ sections: [{ blocks: [{ kind: "text", products: [] }] }] }),
    ).toEqual([]);
    expect(configuredPageProducts(null)).toEqual([]);
  });

  it("never repeats a product referenced twice", () => {
    const twice = {
      sections: [
        { blocks: [{ kind: "product_selection", products: [{ id: "a" }, { id: "a" }] }] },
      ],
    };
    expect(configuredPageProducts(twice).map((p) => p.id)).toEqual(["a"]);
  });

  it("keeps a draft product hidden and an active one listed", () => {
    expect(isPubliclyListable("active")).toBe(true);
    expect(isPubliclyListable("draft")).toBe(false);
    expect(isPubliclyListable(null)).toBe(false);
  });
});

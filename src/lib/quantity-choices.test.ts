import { describe, expect, it } from "vitest";

import { integerQuantityChoices } from "@/lib/quantity-choices";

describe("integerQuantityChoices", () => {
  it("defaults to 1–30 when Admin set no bounds", () => {
    expect(integerQuantityChoices(null, null)[0]).toBe(1);
    expect(integerQuantityChoices(null, null).at(-1)).toBe(30);
    expect(integerQuantityChoices(null, null)).toHaveLength(30);
  });

  it("keeps a configured max", () => {
    expect(integerQuantityChoices(2, 5)).toEqual([2, 3, 4, 5]);
  });

  it("does not drop below min when min is above the default max", () => {
    expect(integerQuantityChoices(40, null)).toEqual([40]);
  });
});

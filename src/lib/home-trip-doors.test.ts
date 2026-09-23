import { describe, expect, it } from "vitest";

import { applyHomeTripDoors, HOME_TRIP_DOORS } from "@/lib/home-trip-doors";
import type { PublicBlock } from "@/lib/website.server";

function door(partial: Partial<PublicBlock> & Pick<PublicBlock, "id" | "title">): PublicBlock {
  return {
    kind: "door",
    body: partial.body ?? null,
    media: null,
    cta: partial.cta ?? { label: "", href: "/home", external: false },
    products: [],
    catalogue_items: [],
    ...partial,
  };
}

describe("applyHomeTripDoors", () => {
  it("retargets the five live Home doors and inserts Family Adventures", () => {
    const out = applyHomeTripDoors([
      door({
        id: "epic",
        title: "Epic Trips",
        cta: { label: "", href: "/pages/firstwaves", external: false },
      }),
      door({
        id: "byt",
        title: "BUILD YOUR TRIP",
        body: "Recommended Option",
        cta: { label: "Configure your experience in 2 minutes", href: "/build-your-trip", external: false },
      }),
      door({
        id: "explore",
        title: "Explore West Java",
        cta: { label: "", href: "/pages/explore-west-java", external: false },
      }),
      door({
        id: "meet",
        title: "Meet the Boardriders",
        cta: { label: "", href: "/pages/meet-the-boardriders", external: false },
      }),
      door({
        id: "book",
        title: "Select Activities individually",
        cta: { label: "All options one by one", href: "/pages/book-individually", external: false },
      }),
    ]);

    expect(out.map((b) => b.title)).toEqual([
      "First Waves",
      "Intermediate & Pro",
      "Family Adventures",
      "Explore West Java",
      "Meet the Boardriders",
      "Select Activities individually",
    ]);
    expect(out[0].cta?.href).toBe(HOME_TRIP_DOORS.firstWaves.href);
    expect(out[0].body).toBeNull();
    expect(out[1].cta?.href).toBe(HOME_TRIP_DOORS.intermediatePro.href);
    expect(out[2].cta?.href).toBe(HOME_TRIP_DOORS.familyAdventures.href);
    expect(out[4].title).toBe("Meet the Boardriders");
  });

  it("leaves non-home blocks without doors unchanged", () => {
    const blocks: PublicBlock[] = [
      {
        id: "text",
        kind: "text",
        title: "Hello",
        body: null,
        media: null,
        cta: null,
        products: [],
        catalogue_items: [],
      },
    ];
    expect(applyHomeTripDoors(blocks)).toEqual(blocks);
  });
});

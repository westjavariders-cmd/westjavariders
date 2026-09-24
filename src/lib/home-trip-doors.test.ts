import { describe, expect, it } from "vitest";

import {
  applyFirstWavesMenuLabel,
  applyHomeTripDoors,
  applyNavImagesToHomeDoors,
  HOME_TRIP_DOORS,
} from "@/lib/home-trip-doors";
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
        body: 'Check first our "BUILD YOUR TRIP" option',
        cta: { label: "All options one by one", href: "/pages/book-individually", external: false },
      }),
    ]);

    expect(out.map((b) => b.title)).toEqual([
      "Catching My First Waves",
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
    const book = out.find((b) => b.id === "book");
    expect(book?.body).toBeNull();
    expect(book?.cta?.label).toBe("");
    expect(book?.cta?.href).toBe("/pages/book-individually");
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

describe("applyNavImagesToHomeDoors", () => {
  it("paints each door with the Navigation photo that shares its href", () => {
    const doors = applyHomeTripDoors([
      door({
        id: "epic",
        title: "Epic Trips",
        cta: { label: "", href: "/pages/epictrips", external: false },
      }),
      door({
        id: "byt",
        title: "BUILD YOUR TRIP",
        cta: { label: "", href: "/build-your-trip", external: false },
      }),
      door({
        id: "explore",
        title: "Explore West Java",
        cta: { label: "", href: "/pages/explore-west-java", external: false },
      }),
    ]);

    const painted = applyNavImagesToHomeDoors(doors, [
      { label: "My First Waves", href: "/pages/firstwaves", image_url: "https://cdn/waves.jpg" },
      { label: "Intermediates and Pros", href: "/pages/intermediatepro", image_url: "https://cdn/pro.jpg" },
      { label: "Family Adventures", href: "/pages/familyadventures", image_url: "https://cdn/family.jpg" },
      { label: "Explore West Java", href: "/pages/explore-west-java", image_url: "https://cdn/explore.jpg" },
    ]);

    expect(painted.find((b) => b.title === "Catching My First Waves")?.media).toEqual({
      kind: "image",
      url: "https://cdn/waves.jpg",
    });
    expect(painted.find((b) => b.title === "Intermediate & Pro")?.media).toEqual({
      kind: "image",
      url: "https://cdn/pro.jpg",
    });
    expect(painted.find((b) => b.title === "Family Adventures")?.media).toEqual({
      kind: "image",
      url: "https://cdn/family.jpg",
    });
    expect(painted.find((b) => b.title === "Explore West Java")?.media).toEqual({
      kind: "image",
      url: "https://cdn/explore.jpg",
    });
  });
});

describe("applyFirstWavesMenuLabel", () => {
  it("renames the First Waves nav item without touching the others", () => {
    const items = applyFirstWavesMenuLabel([
      { label: "My First Waves", href: "/pages/firstwaves" },
      { label: "Intermediate & Pro", href: "/pages/intermediatepro" },
      { label: "Explore West Java", href: "/pages/explore-west-java" },
    ]);
    expect(items.map((item) => item.label)).toEqual([
      "Catching My First Waves",
      "Intermediate & Pro",
      "Explore West Java",
    ]);
  });
});

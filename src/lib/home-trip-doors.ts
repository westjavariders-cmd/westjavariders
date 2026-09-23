/**
 * Home mosaic tiles are CMS doors, not the header nav.
 * Cloud already has audience pages at firstwaves / intermediatepro /
 * familyadventures; the five old Home titles were never retargeted.
 * This remap is presentation-only: it does not change cart or configurator.
 */

import type { PublicBlock } from "@/lib/website.server";

export const HOME_TRIP_DOORS = {
  firstWaves: { title: "First Waves", href: "/pages/firstwaves" },
  intermediatePro: { title: "Intermediate & Pro", href: "/pages/intermediatepro" },
  familyAdventures: { title: "Family Adventures", href: "/pages/familyadventures" },
} as const;

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hrefOf(block: PublicBlock): string {
  return block.cta?.href ?? "";
}

function isEpicNamed(title: string): boolean {
  return title === "epic trips" || title === "epic trip";
}

function isFirstWavesNamed(title: string): boolean {
  return title === "build your trip" || title === "first waves" || title === "my first waves";
}

function isIntermediateNamed(title: string): boolean {
  return (
    isEpicNamed(title) ||
    title === "intermediate & pro" ||
    title === "intermediates and pros" ||
    title === "intermediate and pro"
  );
}

function isFirstWavesDoor(block: PublicBlock): boolean {
  const title = norm(block.title);
  const href = hrefOf(block);
  if (isIntermediateNamed(title) || title === "family adventures") return false;
  return (
    isFirstWavesNamed(title) ||
    href === "/build-your-trip" ||
    href.endsWith("/pages/firstwaves") ||
    href.endsWith("/pages/first-waves")
  );
}

function isIntermediateDoor(block: PublicBlock): boolean {
  const title = norm(block.title);
  const href = hrefOf(block);
  if (isFirstWavesNamed(title) || title === "family adventures") return false;
  return (
    isIntermediateNamed(title) ||
    href.endsWith("/pages/epictrips") ||
    href.endsWith("/pages/epic-trips") ||
    href.endsWith("/pages/intermediatepro") ||
    href.endsWith("/pages/intermediate-and-pro")
  );
}

function isFamilyDoor(block: PublicBlock): boolean {
  const title = norm(block.title);
  const href = hrefOf(block);
  return (
    title === "family adventures" ||
    href.endsWith("/pages/familyadventures") ||
    href.endsWith("/pages/family-adventures")
  );
}

function pointDoor(
  block: PublicBlock,
  spec: { title: string; href: string },
  clearBytCopy: boolean,
): PublicBlock {
  return {
    ...block,
    title: spec.title,
    body: clearBytCopy ? null : block.body,
    cta: { label: clearBytCopy ? "" : (block.cta?.label ?? ""), href: spec.href, external: false },
  };
}

function syntheticFamilyDoor(): PublicBlock {
  return {
    id: "home-door-family-adventures",
    kind: "door",
    title: HOME_TRIP_DOORS.familyAdventures.title,
    body: null,
    media: null,
    cta: { label: "", href: HOME_TRIP_DOORS.familyAdventures.href, external: false },
    products: [],
    catalogue_items: [],
  };
}

/** Rewrite Home door titles/hrefs so the mosaic matches the live audience pages. */
export function applyHomeTripDoors(blocks: PublicBlock[]): PublicBlock[] {
  const doors = blocks.filter((block) => block.kind === "door");
  if (doors.length === 0) return blocks;
  const others = blocks.filter((block) => block.kind !== "door");

  let firstWaves: PublicBlock | undefined;
  let intermediate: PublicBlock | undefined;
  let family: PublicBlock | undefined;
  const rest: PublicBlock[] = [];

  for (const door of doors) {
    if (!firstWaves && isFirstWavesDoor(door)) {
      firstWaves = pointDoor(door, HOME_TRIP_DOORS.firstWaves, norm(door.title) === "build your trip");
      continue;
    }
    if (!intermediate && isIntermediateDoor(door)) {
      intermediate = pointDoor(door, HOME_TRIP_DOORS.intermediatePro, false);
      continue;
    }
    if (!family && isFamilyDoor(door)) {
      family = pointDoor(door, HOME_TRIP_DOORS.familyAdventures, false);
      continue;
    }
    rest.push(door);
  }

  if (!family) family = syntheticFamilyDoor();

  return [...[firstWaves, intermediate, family].filter(Boolean) as PublicBlock[], ...rest, ...others];
}

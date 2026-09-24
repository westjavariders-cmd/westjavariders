/**
 * Home mosaic tiles are CMS doors, not the header nav.
 * Cloud already has audience pages at firstwaves / intermediatepro /
 * familyadventures; the five old Home titles were never retargeted.
 * This remap is presentation-only: it does not change cart or configurator.
 */

import type { PublicBlock } from "@/lib/website.server";

export const HOME_TRIP_DOORS = {
  firstWaves: { title: "Catching My First Waves", href: "/pages/firstwaves" },
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
  return (
    title === "build your trip" ||
    title === "first waves" ||
    title === "my first waves" ||
    title === "catching my first waves"
  );
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

function isBookIndividuallyDoor(block: PublicBlock): boolean {
  const title = norm(block.title);
  const href = hrefOf(block);
  return (
    title.includes("select activities") ||
    title === "book individually" ||
    href.endsWith("/pages/book-individually") ||
    href.endsWith("/book-individually")
  );
}

function stripDoorSubtitles(block: PublicBlock): PublicBlock {
  return {
    ...block,
    body: null,
    cta: block.cta ? { ...block.cta, label: "" } : null,
  };
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

  return [...[firstWaves, intermediate, family].filter(Boolean) as PublicBlock[], ...rest, ...others].map(
    (block) => (block.kind === "door" && isBookIndividuallyDoor(block) ? stripDoorSubtitles(block) : block),
  );
}

export type HomeNavImage = {
  label: string;
  href: string;
  image_url: string | null;
};

function pathOf(href: string): string {
  const trimmed = href.trim();
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(trimmed, "https://westjavariders.invalid");
    return (url.pathname.replace(/\/+$/, "") || "/") as string;
  } catch {
    return trimmed.replace(/\/+$/, "") || "/";
  }
}

/** Public menu label for the First Waves audience (header + Home tile). */
export function applyFirstWavesMenuLabel<T extends { label: string; href: string }>(items: T[]): T[] {
  return items.map((item) => {
    const title = norm(item.label);
    const href = pathOf(item.href);
    const isWaves =
      isFirstWavesNamed(title) ||
      href.endsWith("/pages/firstwaves") ||
      href.endsWith("/pages/first-waves");
    if (!isWaves) return item;
    if (title === "family adventures" || isIntermediateNamed(title)) return item;
    return { ...item, label: HOME_TRIP_DOORS.firstWaves.title };
  });
}

function navImageForDoor(block: PublicBlock, nav: HomeNavImage[]): string | null {
  const doorPath = pathOf(hrefOf(block));
  const doorTitle = norm(block.title);
  const byHref = nav.find((item) => item.image_url && pathOf(item.href) === doorPath);
  if (byHref?.image_url) return byHref.image_url;
  const byLabel = nav.find((item) => item.image_url && norm(item.label) === doorTitle);
  return byLabel?.image_url ?? null;
}

/** Fill Home door tiles with the same photos Admin set on Navigation. */
export function applyNavImagesToHomeDoors(blocks: PublicBlock[], nav: HomeNavImage[]): PublicBlock[] {
  if (nav.length === 0) return blocks;
  return blocks.map((block) => {
    if (block.kind !== "door") return block;
    const imageUrl = navImageForDoor(block, nav);
    if (!imageUrl) return block;
    return { ...block, media: { kind: "image", url: imageUrl } };
  });
}

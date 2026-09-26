/**
 * Website configuration — pure helpers shared by Admin and the public site.
 *
 * This layer only describes presentation: pages, sections, blocks, their
 * order, their visibility, their text per language and where their button
 * goes. It never prices anything and never owns commercial data — products
 * are referenced by their existing identity.
 */

export const WEBSITE_MEDIA_BUCKET = "website-media";

/** Settings keys for chrome photos (public pages + header bar). */
export const SITE_BACKGROUND_SETTING_KEY = "website_site_background_path";
export const HEADER_BACKGROUND_SETTING_KEY = "website_header_background_path";
export const LANDING_CTA_IMAGE_SETTING_KEY = "website_landing_cta_image_path";
export const WEBSITE_CHROME_SETTING_KEYS = [SITE_BACKGROUND_SETTING_KEY, HEADER_BACKGROUND_SETTING_KEY] as const;
export type WebsiteChromeSlot = "site" | "header";

export function chromeImageSettingKey(slot: WebsiteChromeSlot): string {
  return slot === "header" ? HEADER_BACKGROUND_SETTING_KEY : SITE_BACKGROUND_SETTING_KEY;
}

export function isChromeImagePath(slot: WebsiteChromeSlot, path: string): boolean {
  const folder = slot === "header" ? "header-background" : "site-background";
  return new RegExp(`^${folder}/[A-Za-z0-9._-]+$`).test(path);
}

export function isSiteBackgroundPath(path: string): boolean {
  return isChromeImagePath("site", path);
}

/** Photo that fills the entry-screen button, stored under website-media. */
export function isLandingCtaImagePath(path: string): boolean {
  return /^landing\/cta-[A-Za-z0-9._-]+$/.test(path);
}

export const BLOCK_KINDS = [
  "hero",
  "image_text",
  "text",
  "product_selection",
  "video",
  "people",
  "door",
  "catalogue",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  hero: "Hero / feature",
  image_text: "Image + text",
  text: "Text / information",
  product_selection: "Product selection",
  video: "Video / media",
  people: "People / team",
  door: "Home door",
  catalogue: "Catalogue (book individually)",
};

export const DESTINATION_KINDS = [
  "none",
  "page",
  "product",
  "build_your_trip",
  "book_individually",
  "external",
] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

export const DESTINATION_LABELS: Record<DestinationKind, string> = {
  none: "No button",
  page: "Website page",
  product: "Product",
  build_your_trip: "SURFCAMP",
  book_individually: "Book individually",
  external: "External link",
};

export const MEDIA_KINDS = ["image", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const HOME_SLUG = "home";
export const BOOK_INDIVIDUALLY_SLUG = "book-individually";
export const FIRST_WAVES_SLUG = "firstwaves";
/**
 * Home has its own address so it stays reachable when the entry screen owns
 * the site root. Buttons pointing at Home therefore never loop back.
 */
export const HOME_ROUTE = "/home";

/* ------------------------------------------------------------------ */
/* Slugs                                                              */
/* ------------------------------------------------------------------ */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Routes stay predictable: lower case words joined by single hyphens. */
export function isSafeSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 80;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ------------------------------------------------------------------ */
/* Visibility and order                                               */
/* ------------------------------------------------------------------ */

/** Only what is switched on, in the configured order (stable for ties). */
export function visibleSorted<T extends { is_active: boolean; sort_order: number }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.is_active)
    .map((r, index) => ({ r, index }))
    .sort((a, b) => a.r.sort_order - b.r.sort_order || a.index - b.index)
    .map((x) => x.r);
}

/* ------------------------------------------------------------------ */
/* Language                                                           */
/* ------------------------------------------------------------------ */

/**
 * Content for the requested language, falling back to the default language
 * when it has not been translated yet. Never machine-translates.
 */
export function pickTranslation<T extends { language_code: string }>(
  rows: T[],
  language: string,
  fallback: string,
): T | null {
  return (
    rows.find((r) => r.language_code === language) ??
    rows.find((r) => r.language_code === fallback) ??
    null
  );
}

/* ------------------------------------------------------------------ */
/* Destinations                                                       */
/* ------------------------------------------------------------------ */

export type Destination = {
  kind: DestinationKind;
  pageSlug?: string | null;
  productId?: string | null;
  externalUrl?: string | null;
};

export type ResolvedDestination = { href: string; external: boolean };

/**
 * Controlled destinations only. Anything incomplete or unsafe resolves to
 * nothing rather than to a broken or arbitrary route.
 */
export function resolveDestination(destination: Destination): ResolvedDestination | null {
  switch (destination.kind) {
    case "build_your_trip":
      return { href: `/pages/${FIRST_WAVES_SLUG}`, external: false };
    case "book_individually":
      return { href: `/pages/${BOOK_INDIVIDUALLY_SLUG}`, external: false };
    case "page": {
      const slug = destination.pageSlug;
      if (!slug || !isSafeSlug(slug)) return null;
      return { href: slug === HOME_SLUG ? HOME_ROUTE : `/pages/${slug}`, external: false };
    }
    case "product": {
      const id = destination.productId;
      if (!id) return null;
      return { href: `/build-your-trip/${id}`, external: false };
    }
    case "external": {
      const url = destination.externalUrl;
      if (!url || !/^https:\/\/[^\s]+$/.test(url)) return null;
      return { href: url, external: true };
    }
    default:
      return null;
  }
}

/** Moves one row within an ordered list. Returns the same array when no move applies. */
export function moveInOrder<T>(rows: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  const moved = next[index] as T;
  next[index] = next[target] as T;
  next[target] = moved;
  return next;
}

/**
 * Public listing rule for products referenced by a website block: only a
 * product that is itself active may appear. Whether it can be booked stays
 * with the existing commercial rule (product + pricing active).
 */
export function isPubliclyListable(productStatus: string | null | undefined): boolean {
  return productStatus === "active";
}

/** Stable public path segment for a CMS section used as a catalogue group. */
export function assignGroupKeys(sections: { id: string; title: string | null }[]): Map<string, string> {
  const keys = new Map<string, string>();
  const used = new Set<string>();
  for (const section of sections) {
    const base = slugify(section.title ?? "") || section.id.replace(/[^a-z0-9]+/gi, "-").slice(0, 12);
    let key = base;
    let n = 2;
    while (used.has(key)) {
      key = `${base}-${n}`;
      n += 1;
    }
    used.add(key);
    keys.set(section.id, key);
  }
  return keys;
}

/**
 * The products a configured page shows, in configured order, taken only from
 * its active product selection blocks. Nothing is added that the block does
 * not reference.
 */
export function configuredPageProducts<T extends { id: string }>(page: {
  sections: { blocks: { kind: string; products: T[] }[] }[];
} | null): T[] {
  if (!page) return [];
  const out: T[] = [];
  const seen = new Set<string>();
  for (const section of page.sections) {
    for (const block of section.blocks) {
      if (block.kind !== "product_selection") continue;
      for (const product of block.products) {
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        out.push(product);
      }
    }
  }
  return out;
}

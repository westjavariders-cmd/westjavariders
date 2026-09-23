/**
 * Server-only reads for the public website.
 *
 * The public never queries the website tables directly. Everything is read
 * here, stripped to what is safe to publish, and joined to the existing
 * product system for product references. No pricing happens in this file.
 */
import { PRODUCT_MEDIA_BUCKET } from "@/lib/catalog";
import { isPurchasable } from "@/lib/pricing";
import {
  WEBSITE_MEDIA_BUCKET,
  isPubliclyListable,
  pickTranslation,
  resolveDestination,
  visibleSorted,
  type BlockKind,
  type MediaKind,
} from "@/lib/website";

const SIGNED_URL_SECONDS = 60 * 60;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function signedMedia(db: any, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(WEBSITE_MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

async function signedProductImage(
  db: any,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/** The configured default language; content falls back to it. */
export async function defaultLanguage(db: any): Promise<string> {
  const { data } = await db
    .from("languages")
    .select("code, is_master, display_order")
    .eq("is_master", true)
    .order("display_order")
    .limit(1);
  return data?.[0]?.code ?? "en";
}

export type PublicBlockProduct = {
  id: string;
  title: string;
  summary: string | null;
  href: string;
  bookable: boolean;
  image_url: string | null;
};

export type PublicBlockCatalogueItem = {
  catalogue_id: string;
  catalogue_name: string;
  item_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  from_price_idr: number | null;
};

export type PublicBlock = {
  id: string;
  kind: BlockKind;
  title: string | null;
  body: string | null;
  media: { kind: MediaKind; url: string } | null;
  cta: { label: string; href: string; external: boolean } | null;
  products: PublicBlockProduct[];
  /** Active, bookable items of the catalogues this block lists. */
  catalogue_items: PublicBlockCatalogueItem[];
};

export type PublicSection = {
  id: string;
  title: string | null;
  subtitle: string | null;
  blocks: PublicBlock[];
};

export type PublicWebsitePage = {
  slug: string;
  title: string | null;
  subtitle: string | null;
  language: string;
  sections: PublicSection[];
};

export type PublicNavItem = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  image_url: string | null;
};

export type PublicLanding = {
  title: string | null;
  subtitle: string | null;
  video_url: string | null;
  image_url: string | null;
  image_alt: string | null;
  cta: { label: string; href: string; external: boolean } | null;
  language: string;
};

/**
 * The entry screen, only when it is switched on. Returns publishable fields
 * plus time-limited media links; never storage paths or Admin-only fields.
 */
export async function websiteLanding(language?: string): Promise<PublicLanding | null> {
  const db = await admin();
  const fallback = await defaultLanguage(db);
  const wanted = language && language.trim() !== "" ? language : fallback;

  const { data: landing } = await db
    .from("website_landing")
    .select(
      "id, is_active, video_path, image_path, image_alt, cta_kind, cta_page_id, cta_product_id, cta_external_url",
    )
    .maybeSingle();
  if (!landing || landing.is_active !== true) return null;

  const [translations, ctaPage, video, image] = await Promise.all([
    db
      .from("website_landing_translations")
      .select("language_code, title, subtitle, cta_label")
      .eq("landing_id", landing.id),
    landing.cta_page_id
      ? db.from("website_pages").select("slug, is_active").eq("id", landing.cta_page_id).maybeSingle()
      : Promise.resolve({ data: null }),
    signedMedia(db, landing.video_path),
    signedMedia(db, landing.image_path),
  ]);

  const text = pickTranslation<any>((translations.data ?? []) as any[], wanted, fallback);
  const destination = resolveDestination({
    kind: landing.cta_kind,
    pageSlug: ctaPage.data?.is_active ? ctaPage.data.slug : null,
    productId: landing.cta_product_id,
    externalUrl: landing.cta_external_url,
  });

  return {
    title: text?.title ?? null,
    subtitle: text?.subtitle ?? null,
    video_url: video,
    image_url: image,
    image_alt: landing.image_alt ?? null,
    cta: destination && text?.cta_label ? { label: text.cta_label, ...destination } : null,
    language: wanted,
  };
}


/** Products referenced by blocks, resolved from the product system only. */
async function resolveProducts(db: any, productIds: string[]) {
  const resolved = new Map<string, PublicBlockProduct>();
  if (productIds.length === 0) return resolved;

  const language = await defaultLanguage(db);
  const [products, pricing, translations] = await Promise.all([
    db.from("products").select("id, internal_name, status, image_path").in("id", productIds),
    db.from("product_pricing").select("product_id, status").in("product_id", productIds),
    db
      .from("product_translations")
      .select("product_id, title, summary")
      .eq("language_code", language)
      .in("product_id", productIds),
  ]);

  const pricingStatus = new Map<string, string>(
    (pricing.data ?? []).map((p: any) => [p.product_id, p.status]),
  );
  const translation = new Map<string, any>(
    (translations.data ?? []).map((t: any) => [t.product_id, t]),
  );

  const listed = (products.data ?? []).filter((p: any) => isPubliclyListable(p.status));
  const images = await Promise.all(
    listed.map((p: any) => signedProductImage(db, p.image_path as string | null | undefined)),
  );

  listed.forEach((product: any, index: number) => {
    const bookable = isPurchasable(product.status, pricingStatus.get(product.id));
    resolved.set(product.id, {
      id: product.id,
      title: translation.get(product.id)?.title || product.internal_name,
      summary: translation.get(product.id)?.summary ?? null,
      href: `/build-your-trip/${product.id}`,
      bookable,
      image_url: images[index] ?? null,
    });
  });
  return resolved;
}

/** One active page, rendered-ready: active sections and blocks, in order. */
export async function websitePage(
  slug: string,
  language?: string,
): Promise<PublicWebsitePage | null> {
  const db = await admin();
  const fallback = await defaultLanguage(db);
  const wanted = language && language.trim() !== "" ? language : fallback;

  const { data: page } = await db
    .from("website_pages")
    .select("id, slug, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!page || page.is_active !== true) return null;

  const [pageTx, sections] = await Promise.all([
    db.from("website_page_translations").select("language_code, title, subtitle").eq("page_id", page.id),
    db
      .from("website_sections")
      .select("id, internal_name, is_active, sort_order")
      .eq("page_id", page.id),
  ]);

  const activeSections = visibleSorted(sections.data ?? []);
  const sectionIds = activeSections.map((s: any) => s.id);

  const [sectionTx, blocks] = await Promise.all([
    sectionIds.length
      ? db
          .from("website_section_translations")
          .select("section_id, language_code, title, subtitle")
          .in("section_id", sectionIds)
      : Promise.resolve({ data: [] }),
    sectionIds.length
      ? db
          .from("website_blocks")
          .select(
            "id, section_id, block_kind, media_kind, media_path, cta_kind, cta_product_id, cta_external_url, cta_page_id, is_active, sort_order",
          )
          .in("section_id", sectionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const activeBlocks = visibleSorted(blocks.data ?? []);
  const blockIds = activeBlocks.map((b: any) => b.id);

  const ctaPageIds = Array.from(
    new Set(activeBlocks.map((b: any) => b.cta_page_id).filter(Boolean)),
  ) as string[];

  const [blockTx, blockProducts, blockCatalogues, ctaPages] = await Promise.all([
    blockIds.length
      ? db
          .from("website_block_translations")
          .select("block_id, language_code, title, body, cta_label")
          .in("block_id", blockIds)
      : Promise.resolve({ data: [] }),
    blockIds.length
      ? db
          .from("website_block_products")
          .select("block_id, product_id, sort_order")
          .in("block_id", blockIds)
      : Promise.resolve({ data: [] }),
    blockIds.length
      ? db
          .from("website_block_catalogues")
          .select("block_id, catalogue_id, sort_order")
          .in("block_id", blockIds)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    ctaPageIds.length
      ? db.from("website_pages").select("id, slug, is_active").in("id", ctaPageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ctaSlug = new Map<string, string | null>(
    (ctaPages.data ?? []).map((p: any) => [p.id, p.is_active ? p.slug : null]),
  );

  const productRefs = (blockProducts.data ?? []).slice().sort(
    (a: any, b: any) => a.sort_order - b.sort_order,
  );
  const products = await resolveProducts(
    db,
    Array.from(new Set(productRefs.map((r: any) => r.product_id))) as string[],
  );

  // Catalogue blocks list the active, customer-safe items of each referenced
  // catalogue, resolved through the same bridge the public booking uses.
  const catalogueRefs = (blockCatalogues.data ?? []) as {
    block_id: string;
    catalogue_id: string;
  }[];
  const { bookableCatalogue } = await import("@/lib/direct-booking.server");
  const catalogues = new Map<string, Awaited<ReturnType<typeof bookableCatalogue>>>();
  for (const id of Array.from(new Set(catalogueRefs.map((r) => r.catalogue_id)))) {
    catalogues.set(id, await bookableCatalogue(id));
  }

  const pageText = pickTranslation<any>((pageTx.data ?? []) as any[], wanted, fallback);

  const sectionsOut: PublicSection[] = await Promise.all(
    activeSections.map(async (section: any) => {
      const text = pickTranslation<any>(
        ((sectionTx.data ?? []) as any[]).filter((t: any) => t.section_id === section.id),
        wanted,
        fallback,
      );

      const blocksOut = await Promise.all(
        activeBlocks
          .filter((b: any) => b.section_id === section.id)
          .map(async (block: any): Promise<PublicBlock> => {
            const blockText = pickTranslation<any>(
              ((blockTx.data ?? []) as any[]).filter((t: any) => t.block_id === block.id),
              wanted,
              fallback,
            );

            const destination = resolveDestination({
              kind: block.cta_kind,
              pageSlug: block.cta_page_id ? (ctaSlug.get(block.cta_page_id) ?? null) : null,
              productId: block.cta_product_id,
              externalUrl: block.cta_external_url,
            });

            const mediaUrl = await signedMedia(db, block.media_path);

            return {
              id: block.id,
              kind: block.block_kind,
              title: blockText?.title ?? null,
              body: blockText?.body ?? null,
              media: mediaUrl && block.media_kind ? { kind: block.media_kind, url: mediaUrl } : null,
              cta: destination
                ? { label: blockText?.cta_label ?? "", ...destination }
                : null,
              products: productRefs
                .filter((r: any) => r.block_id === block.id)
                .map((r: any) => products.get(r.product_id))
                .filter((p: unknown): p is PublicBlockProduct => Boolean(p)),
              catalogue_items: catalogueRefs
                .filter((r) => r.block_id === block.id)
                .flatMap((r) => {
                  const catalogue = catalogues.get(r.catalogue_id);
                  if (!catalogue) return [];
                  return catalogue.items.map(
                    (item): PublicBlockCatalogueItem => ({
                      catalogue_id: catalogue.id,
                      catalogue_name: catalogue.name,
                      item_id: item.id,
                      name: item.name,
                      description: item.description,
                      photo_url: item.photo_url,
                      from_price_idr: item.from_price_idr,
                    }),
                  );
                }),
            };
          }),
      );

      return {
        id: section.id,
        title: text?.title ?? null,
        subtitle: text?.subtitle ?? null,
        blocks: blocksOut,
      };
    }),
  );

  return {
    slug: page.slug,
    title: pageText?.title ?? null,
    subtitle: pageText?.subtitle ?? null,
    language: wanted,
    sections: sectionsOut,
  };
}

/** The global menu: active items only, with resolved safe destinations. */
export async function websiteNav(language?: string): Promise<PublicNavItem[]> {
  const db = await admin();
  const fallback = await defaultLanguage(db);
  const wanted = language && language.trim() !== "" ? language : fallback;

  const [items, pages] = await Promise.all([
    db
      .from("website_nav_items")
      .select(
        "id, destination_kind, destination_page_id, destination_product_id, destination_external_url, is_active, sort_order, image_path",
      ),
    db.from("website_pages").select("id, slug, is_active"),
  ]);

  const slug = new Map<string, string | null>(
    (pages.data ?? []).map((p: any) => [p.id, p.is_active ? p.slug : null]),
  );
  const active = visibleSorted(items.data ?? []);
  const ids = active.map((i: any) => i.id);

  const translations = ids.length
    ? await db
        .from("website_nav_item_translations")
        .select("nav_item_id, language_code, label")
        .in("nav_item_id", ids)
    : { data: [] };

  return (
    await Promise.all(
      active.map(async (item: any) => {
        const destination = resolveDestination({
          kind: item.destination_kind,
          pageSlug: item.destination_page_id ? (slug.get(item.destination_page_id) ?? null) : null,
          productId: item.destination_product_id,
          externalUrl: item.destination_external_url,
        });
        const text = pickTranslation<any>(
          ((translations.data ?? []) as any[]).filter((t: any) => t.nav_item_id === item.id),
          wanted,
          fallback,
        );
        if (!destination || !text?.label) return null;
        return {
          id: item.id,
          label: text.label,
          ...destination,
          image_url: await signedMedia(db, item.image_path ?? null),
        };
      }),
    )
  ).filter((i: unknown): i is PublicNavItem => Boolean(i));
}

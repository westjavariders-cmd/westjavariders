/**
 * Server-only reads for the public website.
 *
 * The public never queries the website tables directly. Everything is read
 * here, stripped to what is safe to publish, and joined to the existing
 * product system for product references. No pricing happens in this file.
 */
import { isPurchasable } from "@/lib/pricing";
import {
  WEBSITE_MEDIA_BUCKET,
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
};

export type PublicBlock = {
  id: string;
  kind: BlockKind;
  title: string | null;
  body: string | null;
  media: { kind: MediaKind; url: string } | null;
  cta: { label: string; href: string; external: boolean } | null;
  products: PublicBlockProduct[];
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

export type PublicNavItem = { id: string; label: string; href: string; external: boolean };

/** Products referenced by blocks, resolved from the product system only. */
async function resolveProducts(db: any, productIds: string[]) {
  const resolved = new Map<string, PublicBlockProduct>();
  if (productIds.length === 0) return resolved;

  const language = await defaultLanguage(db);
  const [products, pricing, translations] = await Promise.all([
    db.from("products").select("id, internal_name, status").in("id", productIds),
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

  for (const product of products.data ?? []) {
    const bookable = isPurchasable(product.status, pricingStatus.get(product.id));
    resolved.set(product.id, {
      id: product.id,
      title: translation.get(product.id)?.title || product.internal_name,
      summary: translation.get(product.id)?.summary ?? null,
      href: `/build-your-trip/${product.id}`,
      bookable,
    });
  }
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

  const [blockTx, blockProducts, ctaPages] = await Promise.all([
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

  const pageText = pickTranslation(pageTx.data ?? [], wanted, fallback);

  const sectionsOut: PublicSection[] = await Promise.all(
    activeSections.map(async (section: any) => {
      const text = pickTranslation(
        (sectionTx.data ?? []).filter((t: any) => t.section_id === section.id),
        wanted,
        fallback,
      );

      const blocksOut = await Promise.all(
        activeBlocks
          .filter((b: any) => b.section_id === section.id)
          .map(async (block: any): Promise<PublicBlock> => {
            const blockText = pickTranslation(
              (blockTx.data ?? []).filter((t: any) => t.block_id === block.id),
              wanted,
              fallback,
            );

            const destination = resolveDestination({
              kind: block.cta_kind,
              pageSlug: block.cta_page_id ? ctaSlug.get(block.cta_page_id) : null,
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
              cta:
                destination && blockText?.cta_label
                  ? { label: blockText.cta_label, ...destination }
                  : null,
              products: productRefs
                .filter((r: any) => r.block_id === block.id)
                .map((r: any) => products.get(r.product_id))
                .filter((p: unknown): p is PublicBlockProduct => Boolean(p)),
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
        "id, destination_kind, destination_page_id, destination_product_id, destination_external_url, is_active, sort_order",
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

  return active
    .map((item: any) => {
      const destination = resolveDestination({
        kind: item.destination_kind,
        pageSlug: item.destination_page_id ? slug.get(item.destination_page_id) : null,
        productId: item.destination_product_id,
        externalUrl: item.destination_external_url,
      });
      const text = pickTranslation(
        (translations.data ?? []).filter((t: any) => t.nav_item_id === item.id),
        wanted,
        fallback,
      );
      if (!destination || !text?.label) return null;
      return { id: item.id, label: text.label, ...destination };
    })
    .filter((i: unknown): i is PublicNavItem => Boolean(i));
}

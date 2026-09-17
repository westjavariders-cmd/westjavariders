/**
 * Website configuration — server functions.
 *
 * Public reads return only published, customer-safe content. Every write is
 * Admin-only, validated server-side and recorded in the existing audit log.
 * Nothing here touches products, pricing, cart, checkout, payments,
 * vouchers or currencies beyond referencing a product by its id.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOCK_KINDS, DESTINATION_KINDS, MEDIA_KINDS, isSafeSlug } from "@/lib/website";

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class WebsiteError extends Error {}
function fail(message: string): never {
  throw new WebsiteError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change the website configuration.");
}

async function audit(
  supabase: any,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  entityRef: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_ref: entityRef,
    details: details as never,
  });
}

const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((v) => (v.trim() === "" ? null : v.trim()))
    .nullable()
    .optional();

const language = z.string().trim().min(2).max(10);

async function nextOrder(supabase: any, table: string, column?: string, value?: string) {
  let query = supabase.from(table).select("sort_order");
  if (column && value) query = query.eq(column, value);
  const { data } = await query;
  const max = (data ?? []).reduce((m: number, r: any) => Math.max(m, r.sort_order ?? 0), -1);
  return max + 1;
}

async function upsertTranslation(
  supabase: any,
  table: string,
  parentColumn: string,
  parentId: string,
  languageCode: string,
  values: Record<string, string | null>,
) {
  const { error } = await supabase
    .from(table)
    .upsert({ [parentColumn]: parentId, language_code: languageCode, ...values }, {
      onConflict: `${parentColumn},language_code`,
    });
  if (error) fail(SAFE_ERROR);
}

async function applyOrder(supabase: any, table: string, orderedIds: string[]) {
  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase.from(table).update({ sort_order: index }).eq("id", id);
    if (error) fail(SAFE_ERROR);
  }
}

/* ------------------------------------------------------------------ */
/* Public reads                                                       */
/* ------------------------------------------------------------------ */

export const getWebsitePage = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ slug: z.string().min(1).max(80), language: z.string().max(10).optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!isSafeSlug(data.slug)) return { page: null };
    const { websitePage } = await import("@/lib/website.server");
    return { page: await websitePage(data.slug, data.language) };
  });

export const getWebsiteNav = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ language: z.string().max(10).optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { websiteNav } = await import("@/lib/website.server");
    return { items: await websiteNav(data.language) };
  });

/* ------------------------------------------------------------------ */
/* Pages                                                              */
/* ------------------------------------------------------------------ */

export const savePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().trim().min(1).max(80),
        internal_name: z.string().trim().min(1).max(120),
        is_active: z.boolean(),
        language,
        title: text(200),
        subtitle: text(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    if (!isSafeSlug(data.slug)) fail("Use lower-case words joined by hyphens for the address.");

    let pageId = data.id ?? null;
    if (pageId) {
      const { error } = await supabase
        .from("website_pages")
        .update({ slug: data.slug, internal_name: data.internal_name, is_active: data.is_active })
        .eq("id", pageId);
      if (error) fail("This page could not be saved. The address may already be in use.");
    } else {
      const { data: row, error } = await supabase
        .from("website_pages")
        .insert({
          slug: data.slug,
          internal_name: data.internal_name,
          is_active: data.is_active,
          sort_order: await nextOrder(supabase, "website_pages"),
        })
        .select("id")
        .single();
      if (error || !row) fail("This page could not be created. The address may already be in use.");
      pageId = row.id as string;
    }

    await upsertTranslation(supabase, "website_page_translations", "page_id", pageId, data.language, {
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
    });
    await audit(supabase, userId, data.id ? "website.page.updated" : "website.page.created", "website_pages", pageId, data.slug);
    return { id: pageId };
  });

export const deletePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("website_pages").delete().eq("id", data.id);
    if (error) fail("This page could not be removed.");
    await audit(supabase, userId, "website.page.deleted", "website_pages", data.id, null);
    return { ok: true };
  });

export const reorderPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    await applyOrder(supabase, "website_pages", data.orderedIds);
    await audit(supabase, userId, "website.pages.reordered", "website_pages", null, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Sections                                                           */
/* ------------------------------------------------------------------ */

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        page_id: z.string().uuid(),
        internal_name: z.string().trim().min(1).max(120),
        is_active: z.boolean(),
        language,
        title: text(200),
        subtitle: text(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    let sectionId = data.id ?? null;
    if (sectionId) {
      const { error } = await supabase
        .from("website_sections")
        .update({ internal_name: data.internal_name, is_active: data.is_active })
        .eq("id", sectionId);
      if (error) fail("This section could not be saved.");
    } else {
      const { data: row, error } = await supabase
        .from("website_sections")
        .insert({
          page_id: data.page_id,
          internal_name: data.internal_name,
          is_active: data.is_active,
          sort_order: await nextOrder(supabase, "website_sections", "page_id", data.page_id),
        })
        .select("id")
        .single();
      if (error || !row) fail("This section could not be created.");
      sectionId = row.id as string;
    }

    await upsertTranslation(
      supabase,
      "website_section_translations",
      "section_id",
      sectionId,
      data.language,
      { title: data.title ?? null, subtitle: data.subtitle ?? null },
    );
    await audit(
      supabase,
      userId,
      data.id ? "website.section.updated" : "website.section.created",
      "website_sections",
      sectionId,
      data.internal_name,
    );
    return { id: sectionId };
  });

export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("website_sections").delete().eq("id", data.id);
    if (error) fail("This section could not be removed.");
    await audit(supabase, userId, "website.section.deleted", "website_sections", data.id, null);
    return { ok: true };
  });

export const reorderSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    await applyOrder(supabase, "website_sections", data.orderedIds);
    await audit(supabase, userId, "website.sections.reordered", "website_sections", null, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Blocks                                                             */
/* ------------------------------------------------------------------ */

export const saveBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        section_id: z.string().uuid(),
        block_kind: z.enum(BLOCK_KINDS),
        internal_name: z.string().trim().min(1).max(120),
        is_active: z.boolean(),
        media_kind: z.enum(MEDIA_KINDS).nullable().optional(),
        media_path: z.string().max(500).nullable().optional(),
        cta_kind: z.enum(DESTINATION_KINDS),
        cta_page_id: z.string().uuid().nullable().optional(),
        cta_product_id: z.string().uuid().nullable().optional(),
        cta_external_url: z.string().max(2000).nullable().optional(),
        language,
        title: text(200),
        body: text(4000),
        cta_label: text(80),
        product_ids: z.array(z.string().uuid()).max(50).optional(),
        catalogue_ids: z.array(z.string().uuid()).max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const mediaKind = data.media_path ? (data.media_kind ?? "image") : null;
    const mediaPath = mediaKind ? data.media_path : null;
    const external = data.cta_kind === "external" ? (data.cta_external_url ?? null) : null;
    if (data.cta_kind === "external" && !(external && /^https:\/\/[^\s]+$/.test(external))) {
      fail("An external link must start with https://");
    }
    if (data.cta_kind === "page" && !data.cta_page_id) fail("Choose the page the button opens.");
    if (data.cta_kind === "product" && !data.cta_product_id) fail("Choose the product the button opens.");

    const row = {
      section_id: data.section_id,
      block_kind: data.block_kind,
      internal_name: data.internal_name,
      is_active: data.is_active,
      media_kind: mediaKind,
      media_path: mediaPath,
      cta_kind: data.cta_kind,
      cta_page_id: data.cta_kind === "page" ? (data.cta_page_id ?? null) : null,
      cta_product_id: data.cta_kind === "product" ? (data.cta_product_id ?? null) : null,
      cta_external_url: external,
    };

    let blockId = data.id ?? null;
    if (blockId) {
      const { error } = await supabase.from("website_blocks").update(row).eq("id", blockId);
      if (error) fail("This block could not be saved.");
    } else {
      const { data: created, error } = await supabase
        .from("website_blocks")
        .insert({
          ...row,
          sort_order: await nextOrder(supabase, "website_blocks", "section_id", data.section_id),
        })
        .select("id")
        .single();
      if (error || !created) fail("This block could not be created.");
      blockId = created.id as string;
    }

    await upsertTranslation(
      supabase,
      "website_block_translations",
      "block_id",
      blockId,
      data.language,
      { title: data.title ?? null, body: data.body ?? null, cta_label: data.cta_label ?? null },
    );

    if (data.product_ids) {
      const { error: clearError } = await supabase
        .from("website_block_products")
        .delete()
        .eq("block_id", blockId);
      if (clearError) fail(SAFE_ERROR);
      if (data.product_ids.length > 0) {
        const { error: insertError } = await supabase.from("website_block_products").insert(
          data.product_ids.map((productId, index) => ({
            block_id: blockId,
            product_id: productId,
            sort_order: index,
          })),
        );
        if (insertError) fail("The referenced products could not be saved.");
      }
    }

    if (data.catalogue_ids) {
      const { error: clearError } = await supabase
        .from("website_block_catalogues")
        .delete()
        .eq("block_id", blockId);
      if (clearError) fail(SAFE_ERROR);
      if (data.catalogue_ids.length > 0) {
        const { error: insertError } = await supabase.from("website_block_catalogues").insert(
          data.catalogue_ids.map((catalogueId, index) => ({
            block_id: blockId,
            catalogue_id: catalogueId,
            sort_order: index,
          })),
        );
        if (insertError) fail("The referenced catalogues could not be saved.");
      }
    }

    await audit(
      supabase,
      userId,
      data.id ? "website.block.updated" : "website.block.created",
      "website_blocks",
      blockId,
      data.internal_name,
      { block_kind: data.block_kind },
    );
    return { id: blockId };
  });

export const deleteBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: block } = await supabase
      .from("website_blocks")
      .select("media_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("website_blocks").delete().eq("id", data.id);
    if (error) fail("This block could not be removed.");
    if (block?.media_path) {
      await supabase.storage.from("website-media").remove([block.media_path]);
    }
    await audit(supabase, userId, "website.block.deleted", "website_blocks", data.id, null);
    return { ok: true };
  });

export const reorderBlocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    await applyOrder(supabase, "website_blocks", data.orderedIds);
    await audit(supabase, userId, "website.blocks.reordered", "website_blocks", null, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Navigation                                                         */
/* ------------------------------------------------------------------ */

export const saveNavItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        internal_name: z.string().trim().min(1).max(120),
        destination_kind: z.enum(DESTINATION_KINDS),
        destination_page_id: z.string().uuid().nullable().optional(),
        destination_product_id: z.string().uuid().nullable().optional(),
        destination_external_url: z.string().max(2000).nullable().optional(),
        is_active: z.boolean(),
        language,
        label: text(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    if (data.destination_kind === "none") fail("Choose where this menu item goes.");
    if (data.destination_kind === "page" && !data.destination_page_id) fail("Choose the page.");
    if (data.destination_kind === "product" && !data.destination_product_id) fail("Choose the product.");
    const external =
      data.destination_kind === "external" ? (data.destination_external_url ?? null) : null;
    if (data.destination_kind === "external" && !(external && /^https:\/\/[^\s]+$/.test(external))) {
      fail("An external link must start with https://");
    }

    const row = {
      internal_name: data.internal_name,
      destination_kind: data.destination_kind,
      destination_page_id: data.destination_kind === "page" ? (data.destination_page_id ?? null) : null,
      destination_product_id:
        data.destination_kind === "product" ? (data.destination_product_id ?? null) : null,
      destination_external_url: external,
      is_active: data.is_active,
    };

    let itemId = data.id ?? null;
    if (itemId) {
      const { error } = await supabase.from("website_nav_items").update(row).eq("id", itemId);
      if (error) fail("This menu item could not be saved.");
    } else {
      const { data: created, error } = await supabase
        .from("website_nav_items")
        .insert({ ...row, sort_order: await nextOrder(supabase, "website_nav_items") })
        .select("id")
        .single();
      if (error || !created) fail("This menu item could not be created.");
      itemId = created.id as string;
    }

    await upsertTranslation(
      supabase,
      "website_nav_item_translations",
      "nav_item_id",
      itemId,
      data.language,
      { label: data.label ?? null },
    );
    await audit(
      supabase,
      userId,
      data.id ? "website.nav.updated" : "website.nav.created",
      "website_nav_items",
      itemId,
      data.internal_name,
    );
    return { id: itemId };
  });

export const deleteNavItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { error } = await supabase.from("website_nav_items").delete().eq("id", data.id);
    if (error) fail("This menu item could not be removed.");
    await audit(supabase, userId, "website.nav.deleted", "website_nav_items", data.id, null);
    return { ok: true };
  });

export const reorderNavItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderedIds: z.array(z.string().uuid()).min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    await applyOrder(supabase, "website_nav_items", data.orderedIds);
    await audit(supabase, userId, "website.nav.reordered", "website_nav_items", null, null);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Entry / Landing                                                    */
/* ------------------------------------------------------------------ */

export const getWebsiteLanding = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ language: z.string().max(10).optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { websiteLanding } = await import("@/lib/website.server");
    return { landing: await websiteLanding(data.language) };
  });

export const saveLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        is_active: z.boolean(),
        video_path: z.string().max(500).nullable().optional(),
        image_path: z.string().max(500).nullable().optional(),
        image_alt: text(200),
        cta_kind: z.enum(DESTINATION_KINDS),
        cta_page_id: z.string().uuid().nullable().optional(),
        cta_product_id: z.string().uuid().nullable().optional(),
        cta_external_url: z.string().max(2000).nullable().optional(),
        language,
        title: text(200),
        subtitle: text(500),
        cta_label: text(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const external = data.cta_kind === "external" ? (data.cta_external_url ?? null) : null;
    if (data.cta_kind === "external" && !(external && /^https:\/\/[^\s]+$/.test(external))) {
      fail("An external link must start with https://");
    }
    if (data.cta_kind === "page" && !data.cta_page_id) fail("Choose the page the button opens.");
    if (data.cta_kind === "product" && !data.cta_product_id) fail("Choose the product the button opens.");

    const { data: existing } = await supabase.from("website_landing").select("id").maybeSingle();

    const row = {
      is_active: data.is_active,
      video_path: data.video_path ?? null,
      image_path: data.image_path ?? null,
      image_alt: data.image_alt ?? null,
      cta_kind: data.cta_kind,
      cta_page_id: data.cta_kind === "page" ? (data.cta_page_id ?? null) : null,
      cta_product_id: data.cta_kind === "product" ? (data.cta_product_id ?? null) : null,
      cta_external_url: external,
    };

    let landingId = existing?.id as string | undefined;
    if (landingId) {
      const { error } = await supabase.from("website_landing").update(row).eq("id", landingId);
      if (error) fail("The entry screen could not be saved.");
    } else {
      const { data: created, error } = await supabase
        .from("website_landing")
        .insert(row)
        .select("id")
        .single();
      if (error || !created) fail("The entry screen could not be saved.");
      landingId = created.id as string;
    }

    await upsertTranslation(
      supabase,
      "website_landing_translations",
      "landing_id",
      landingId,
      data.language,
      { title: data.title ?? null, subtitle: data.subtitle ?? null, cta_label: data.cta_label ?? null },
    );
    await audit(supabase, userId, "website.landing.updated", "website_landing", landingId, null, {
      is_active: data.is_active,
    });
    return { id: landingId };
  });

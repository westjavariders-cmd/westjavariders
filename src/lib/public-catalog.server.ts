/**
 * Server-only reads for the public layer.
 *
 * Customers are anonymous and have no direct access to the commercial tables:
 * every read here is performed server-side and stripped of internal data
 * (supplier costs, internal notes, margins are never returned).
 */
import { MASTER_LANGUAGE, type ProductBundle } from "@/lib/catalog";
import {
  fieldCatalogueRefs,
  type CatalogueItem,
  type CatalogueItemsByKey,
} from "@/lib/catalogue-bridge";
import { resolveCatalogues } from "@/lib/catalogue-bridge.server";
import { isPurchasable } from "@/lib/pricing";
import { fail, listCart } from "@/lib/cart.server";
import type { AnswerSummaryLine } from "@/lib/public-catalog";
import { orderedAnswerSummary } from "@/lib/answer-summary.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

import { fxContext, displayAmount } from "@/lib/fx.server";
import { toPublicFx, type PublicFxContext } from "@/lib/fx.functions";

export type PublicProduct = {
  id: string;
  title: string;
  summary: string | null;
  categories: string[];
};

/** Products that are commercially purchasable (active product + active pricing). */
export async function listPurchasableProducts(): Promise<PublicProduct[]> {
  const db = await admin();
  const [products, pricing, translations, links, categories] = await Promise.all([
    db.from("products").select("id, internal_name, voucher_name, status, kind").order("sort_order"),
    db.from("product_pricing").select("product_id, status"),
    db
      .from("product_translations")
      .select("product_id, title, summary")
      .eq("language_code", MASTER_LANGUAGE),
    db.from("product_categories").select("product_id, category_id"),
    db.from("categories").select("id, name, is_active"),
  ]);

  const pricingStatus = new Map<string, string>(
    (pricing.data ?? []).map((p: any) => [p.product_id, p.status]),
  );
  const translation = new Map<string, any>((translations.data ?? []).map((t: any) => [t.product_id, t]));
  const categoryName = new Map<string, string>(
    (categories.data ?? []).filter((c: any) => c.is_active).map((c: any) => [c.id, c.name]),
  );

  return (products.data ?? [])
    .filter((p: any) => isPurchasable(p.status, pricingStatus.get(p.id)))
    .map((p: any) => ({
      id: p.id,
      title: p.voucher_name?.trim() || translation.get(p.id)?.title || p.internal_name,
      summary: translation.get(p.id)?.summary ?? null,
      categories: (links.data ?? [])
        .filter((l: any) => l.product_id === p.id)
        .map((l: any) => categoryName.get(l.category_id))
        .filter((n: unknown): n is string => typeof n === "string"),
    }));
}

export type PublicBundle = {
  product: { id: string; title: string; summary: string | null; body: string | null };
  bundle: ProductBundle;
  /** Active, customer-safe catalogue items per catalogue type used by the fields. */
  catalogue: CatalogueItemsByKey;
};

/** The saved Phase 3 configuration of one purchasable product, without internal data. */
export async function publicProductBundle(productId: string): Promise<PublicBundle> {
  const db = await admin();
  const { data: product } = await db
    .from("products")
    .select("id, internal_name, voucher_name, status, kind")
    .eq("id", productId)
    .maybeSingle();
  if (!product) fail("This product could not be found.");

  const { data: pricing } = await db
    .from("product_pricing")
    .select("status")
    .eq("product_id", productId)
    .maybeSingle();
  if (!isPurchasable(product.status, pricing?.status)) {
    fail("This product is not available for booking right now.");
  }

  const [translation, flow, fields, dependencies] = await Promise.all([
    db
      .from("product_translations")
      .select("title, summary, body")
      .eq("product_id", productId)
      .eq("language_code", MASTER_LANGUAGE)
      .maybeSingle(),
    db.from("config_flows").select("*").eq("product_id", productId).maybeSingle(),
    db.from("fields").select("*").eq("product_id", productId).order("display_order"),
    db.from("dependencies").select("*").eq("product_id", productId),
  ]);

  const steps = flow.data
    ? ((await db.from("steps").select("*").eq("flow_id", flow.data.id).order("display_order")).data ?? [])
    : [];
  const fieldIds = (fields.data ?? []).map((f: any) => f.id);
  const options = fieldIds.length
    ? ((await db.from("field_options").select("*").in("field_id", fieldIds).order("display_order")).data ?? [])
    : [];

  const catalogue = await resolveCatalogues(
    fieldCatalogueRefs((fields.data ?? []).filter((f: any) => f.is_active) as never),
  );

  return {
    catalogue,
    product: {
      id: product.id,
      title: (product as any).voucher_name?.trim() || translation.data?.title || product.internal_name,
      summary: translation.data?.summary ?? null,
      body: translation.data?.body ?? null,
    },
    bundle: {
      product,
      translation: null,
      categoryIds: [],
      placements: [],
      // Components carry supplier costs, so they never reach the browser.
      components: [],
      flow: flow.data,
      steps,
      fields: fields.data ?? [],
      options,
      dependencies: dependencies.data ?? [],
    },
  };
}

export type PublicCartPackage = {
  id: string;
  /** Null on direct catalogue bookings, which have no product. */
  product_id: string | null;
  product_title: string;
  status: string;
  total_idr: number;
  subtotal_idr: number;
  season_discount_idr: number;
  promo_discount_idr: number;
  promo_code: string | null;
  summary: AnswerSummaryLine[];
};

export type PublicCartView = {
  packages: PublicCartPackage[];
  draft: PublicCartPackage | null;
  payable_total_idr: number;
  /** Currency the visitor is browsing in, resolved on the server. */
  fx: PublicFxContext;
  /** The payable total converted once into that currency. */
  payable_total_customer: number;
};

/** The customer's cart, server-authoritative, with readable configuration summaries. */
export async function publicCart(token?: string): Promise<PublicCartView> {
  const cart = await listCart(token);
  const fx = await fxContext();
  const rows = [...cart.packages, ...(cart.draft ? [cart.draft] : [])] as any[];
  if (rows.length === 0) {
    return {
      packages: [],
      draft: null,
      payable_total_idr: 0,
      fx: toPublicFx(fx),
      payable_total_customer: 0,
    };
  }

  const db = await admin();
  const productIds = Array.from(
    new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id))),
  );
  const [products, translations, fields] = await Promise.all([
    db.from("products").select("id, internal_name, voucher_name").in("id", productIds),
    db
      .from("product_translations")
      .select("product_id, title")
      .in("product_id", productIds)
      .eq("language_code", MASTER_LANGUAGE),
    db.from("fields").select("*").in("product_id", productIds).order("display_order"),
  ]);
  const fieldIds = (fields.data ?? []).map((f: any) => f.id);
  const options = fieldIds.length
    ? ((await db.from("field_options").select("*").in("field_id", fieldIds).order("display_order")).data ?? [])
    : [];

  const titles = new Map<string, string>();
  for (const p of products.data ?? []) titles.set(p.id, p.internal_name);
  for (const t of translations.data ?? []) if (t.title) titles.set(t.product_id, t.title);
  // The display name set on the product wins over the catalogue title.
  for (const p of products.data ?? []) {
    const display = (p as any).voucher_name?.trim();
    if (display) titles.set(p.id, display);
  }


  const view = async (row: any): Promise<PublicCartPackage> => ({
    id: row.id,
    product_id: row.product_id,
    product_title:
      row.line_kind === "catalogue_item"
        ? (row.item_title ?? "Item")
        : (titles.get(row.product_id) ?? "Package"),
    status: row.status,
    total_idr: Number(row.total_idr),
    subtotal_idr: Number(row.subtotal_idr),
    season_discount_idr: Number(row.season_discount_idr),
    promo_discount_idr: Number(row.promo_discount_idr),
    promo_code: row.promo_code ?? null,
    summary:
      row.line_kind === "catalogue_item"
        ? ((row.quote_lines ?? []) as AnswerSummaryLine[])
        : await orderedAnswerSummary(
            db,
            row.product_id,
            row.answers,
            row.catalogue_selections,
          ),
  });

  return {
    packages: await Promise.all((cart.packages as any[]).map(view)),
    draft: cart.draft ? await view(cart.draft) : null,
    payable_total_idr: cart.payable_total_idr,
    fx: toPublicFx(fx),
    payable_total_customer: displayAmount(cart.payable_total_idr, fx),
  };
}

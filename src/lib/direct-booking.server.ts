/**
 * Direct catalogue booking — server layer.
 *
 * Reads only through the existing Catalogue Bridge resolver, so an inactive
 * catalogue or item resolves to nothing and supplier costs never leave the
 * server. Prices are always recomputed here from the live catalogue: the
 * browser never supplies an amount.
 *
 * A direct booking is stored as an ordinary cart line (a `packages` row with
 * `line_kind = 'catalogue_item'`), so checkout, the immutable snapshot,
 * payment and vouchers keep working unchanged.
 */
import {
  CATALOGUE_TYPE_OF_TEMPLATE,
  type CatalogueTemplate,
} from "@/lib/catalogues";
import type { CatalogueItem, CatalogueType } from "@/lib/catalogue-bridge";
import { resolveCatalogue } from "@/lib/catalogue-bridge.server";
import {
  directFromPriceIdr,
  priceDirectBooking,
  type DirectBookingChoices,
  type DirectPriceResult,
} from "@/lib/direct-booking";
import { currentCart, fail } from "@/lib/cart.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

export type BookableCatalogue = {
  id: string;
  catalogue_type: CatalogueType;
  name: string;
  items: (CatalogueItem & { from_price_idr: number | null })[];
};

/** The active catalogue behind an id, or null when it cannot be offered. */
async function activeCatalogue(
  db: any,
  catalogueId: string,
): Promise<{ id: string; name: string; catalogue_type: CatalogueType } | null> {
  const { data } = await db
    .from("catalogues")
    .select("id, internal_name, public_name, template, active")
    .eq("id", catalogueId)
    .maybeSingle();
  if (!data || data.active !== true) return null;
  const type = CATALOGUE_TYPE_OF_TEMPLATE[data.template as CatalogueTemplate];
  if (!type) return null;
  return {
    id: data.id as string,
    name: (data.public_name?.trim() || data.internal_name) as string,
    catalogue_type: type,
  };
}

/** Active, customer-safe items of one catalogue, with a "from" price each. */
export async function bookableCatalogue(catalogueId: string): Promise<BookableCatalogue | null> {
  const db = await admin();
  const catalogue = await activeCatalogue(db, catalogueId);
  if (!catalogue) return null;

  const items = await resolveCatalogue({
    catalogue_type: catalogue.catalogue_type,
    catalogue_id: catalogue.id,
  });

  return {
    id: catalogue.id,
    catalogue_type: catalogue.catalogue_type,
    name: catalogue.name,
    items: items.map((item) => ({ ...item, from_price_idr: directFromPriceIdr(item) })),
  };
}

/** One bookable item, resolved live. Never returns an inactive item. */
export async function bookableItem(
  catalogueId: string,
  itemId: string,
): Promise<{ catalogue: BookableCatalogue; item: CatalogueItem } | null> {
  const catalogue = await bookableCatalogue(catalogueId);
  if (!catalogue) return null;
  const item = catalogue.items.find((i) => i.id === itemId);
  if (!item) return null;
  return { catalogue, item };
}

export type DirectQuote = DirectPriceResult & {
  catalogue_id: string;
  catalogue_type: CatalogueType;
  item_id: string;
  item_name: string;
  choices: DirectBookingChoices;
};

/** One provisional quote for a direct booking. Never a stored price. */
export async function quoteDirectBooking(args: {
  catalogueId: string;
  itemId: string;
  choices: DirectBookingChoices;
}): Promise<DirectQuote | null> {
  const resolved = await bookableItem(args.catalogueId, args.itemId);
  if (!resolved) return null;
  const price = priceDirectBooking(resolved.item, args.choices);
  return {
    ...price,
    catalogue_id: resolved.catalogue.id,
    catalogue_type: resolved.catalogue.catalogue_type,
    item_id: resolved.item.id,
    item_name: resolved.item.name,
    choices: args.choices,
  };
}

/** Only the answers this template actually asks for are stored. */
function storedAnswers(type: CatalogueType, choices: DirectBookingChoices) {
  if (type === "accommodation_room") return { nights: choices.nights ?? null };
  if (type === "motorbike") return { days: choices.days ?? null };
  if (type === "transport") return { people: choices.people ?? null, hours: choices.hours ?? null };
  return {};
}

/**
 * Adds one direct booking to the cart as a complete line. It never touches an
 * in-progress configured package, and the amount comes from the live
 * catalogue only.
 */
export async function addDirectBookingToCart(args: {
  catalogueId: string;
  itemId: string;
  choices: DirectBookingChoices;
  token?: string;
}) {
  const quote = await quoteDirectBooking({
    catalogueId: args.catalogueId,
    itemId: args.itemId,
    choices: args.choices,
  });
  if (!quote) fail("This item is no longer available. Please choose another one.");
  if (quote.issues.length > 0) fail(quote.issues[0]!);
  if (quote.total_idr == null || quote.total_idr <= 0) fail("This item has no price yet.");

  const cart = (await currentCart(true, args.token))!;
  const db = await admin();

  const { data: last } = await db
    .from("cart_packages")
    .select("position")
    .eq("cart_id", cart.id)
    .order("position", { ascending: false })
    .limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;

  const { data: line, error } = await db
    .from("packages")
    .insert({
      line_kind: "catalogue_item",
      product_id: null,
      catalogue_id: quote.catalogue_id,
      catalogue_type: quote.catalogue_type,
      catalogue_item_id: quote.item_id,
      item_title: quote.item_name,
      status: "complete",
      answers: storedAnswers(quote.catalogue_type, args.choices) as never,
      resolved_inputs: {} as never,
      catalogue_selections: [
        {
          variable_name: "item",
          catalogue_type: quote.catalogue_type,
          catalogue_id: quote.catalogue_id,
          item_id: quote.item_id,
          name: quote.item_name,
          reference: null,
          customer_price_idr: quote.total_idr,
        },
      ] as never,
      quote_lines: quote.summary as never,
      subtotal_idr: quote.total_idr,
      season_discount_idr: 0,
      promo_discount_idr: 0,
      total_idr: quote.total_idr,
      quoted_at: new Date().toISOString(),
    })
    .select("id, total_idr")
    .single();
  if (error || !line) fail(SAFE_ERROR);

  const { error: linkError } = await db
    .from("cart_packages")
    .insert({ cart_id: cart.id, package_id: line.id, position });
  if (linkError) {
    await db.from("packages").delete().eq("id", line.id);
    fail(SAFE_ERROR);
  }

  // Adding to the cart creates the voucher (UNPAID) with its correlative
  // number, exactly like a configured package.
  try {
    const { ensureVoucherForCartLine } = await import("@/lib/voucher.server");
    await ensureVoucherForCartLine(line.id as string, cart.id);
  } catch {
    // A numbering failure must never block the booking.
  }

  return { cartId: cart.id, lineId: line.id as string, total_idr: Number(line.total_idr) };
}

/**
 * Recomputes one stored direct line from the live catalogue, for checkout
 * revalidation. A withdrawn item or a price change is reported, never hidden.
 */
export async function revalidateDirectLine(row: {
  id: string;
  catalogue_id: string | null;
  catalogue_item_id: string | null;
  item_title: string | null;
  answers: Record<string, unknown> | null;
  total_idr: number | string;
}) {
  const title = row.item_title || "Item";
  const answers = (row.answers ?? {}) as DirectBookingChoices;

  if (!row.catalogue_id || !row.catalogue_item_id) {
    return { title, total_idr: 0, summary: [], blockers: [`${title} is no longer available.`] };
  }

  const quote = await quoteDirectBooking({
    catalogueId: row.catalogue_id,
    itemId: row.catalogue_item_id,
    choices: answers,
  });
  if (!quote) {
    return { title, total_idr: 0, summary: [], blockers: [`${title} is no longer available.`] };
  }

  const blockers = quote.issues.map((issue) => `${title}: ${issue}`);
  if (quote.total_idr == null || quote.total_idr <= 0) {
    blockers.push(`${title} has no price right now.`);
  }

  return {
    title: quote.item_name || title,
    total_idr: quote.total_idr ?? 0,
    summary: quote.summary,
    blockers,
  };
}

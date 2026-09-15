/**
 * Save & share a trip — server layer.
 *
 * A saved trip is a small list of configuration references. Products and
 * catalogues remain the single source of truth: reopening a trip re-quotes
 * every line with the existing pricing engine, so a changed price is the
 * current price and a withdrawn product is reported, never hidden.
 */
import { currentCart, fail, quotePackage } from "@/lib/cart.server";
import { orderedAnswerSummary } from "@/lib/answer-summary.server";
import { displayAmount, fxContext } from "@/lib/fx.server";
import { toPublicFx, type PublicFxContext } from "@/lib/fx.functions";
import { MASTER_LANGUAGE } from "@/lib/catalog";
import type { AnswerSummaryLine } from "@/lib/public-catalog";
import type { PreviewValues } from "@/lib/catalog";
import {
  generateTripCode,
  normalizeTripCode,
  parseSavedTripLines,
  toSavedTripLine,
  type SavedTripLine,
} from "@/lib/saved-trip";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const SAFE_ERROR = "This action could not be completed. Please try again.";

function randomFromCrypto(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0) / 0x1_0000_0000;
}

/* ------------------------------------------------------------------ */
/* Save                                                               */
/* ------------------------------------------------------------------ */

/** Stores the current cart configuration and returns its share code. */
export async function saveCurrentTrip(token?: string): Promise<{ code: string }> {
  const cart = await currentCart(false, token);
  if (!cart) fail("Your cart is empty, so there is nothing to save yet.");

  const db = await admin();
  const { data: rows } = await db
    .from("cart_packages")
    .select(
      "position, packages!inner(id, status, line_kind, product_id, catalogue_id, catalogue_item_id, answers, season_month, promo_code)",
    )
    .eq("cart_id", cart.id)
    .order("position");

  const lines: SavedTripLine[] = [];
  for (const row of rows ?? []) {
    const pkg = (row as any).packages;
    if (!pkg || pkg.status !== "complete") continue;
    const line = toSavedTripLine(pkg);
    if (line) lines.push(line);
  }
  if (lines.length === 0) fail("Your cart is empty, so there is nothing to save yet.");

  // One share link per cart: sharing again reuses the same link and simply
  // refreshes the configuration it points at. No second record is created.
  const { data: existing } = await db
    .from("saved_trips")
    .select("code")
    .eq("cart_id", cart.id)
    .maybeSingle();
  if (existing?.code) {
    await db
      .from("saved_trips")
      .update({ lines: lines as never })
      .eq("cart_id", cart.id);
    return { code: existing.code as string };
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateTripCode(randomFromCrypto);
    const { data, error } = await db
      .from("saved_trips")
      .insert({ code, cart_id: cart.id, lines: lines as never })
      .select("code")
      .maybeSingle();
    if (data?.code) return { code: data.code as string };
    // 23505 = unique violation on `code`: try another one.
    if (error && (error as any).code !== "23505") fail(SAFE_ERROR);
  }
  fail(SAFE_ERROR);
}

/* ------------------------------------------------------------------ */
/* Read                                                               */
/* ------------------------------------------------------------------ */

export type SavedTripViewLine = {
  title: string;
  summary: AnswerSummaryLine[];
  total_idr: number;
  /** Customer-facing reasons this line cannot be booked right now. */
  blockers: string[];
  available: boolean;
};

export type SavedTripView = {
  code: string;
  lines: SavedTripViewLine[];
  total_idr: number;
  fx: PublicFxContext;
  customer_total: number;
  /** True when at least one line can still be booked. */
  bookable: boolean;
};

async function storedTrip(code: string) {
  const normalized = normalizeTripCode(code);
  if (!normalized) return null;
  const db = await admin();
  const { data } = await db
    .from("saved_trips")
    .select("code, lines, expires_at")
    .eq("code", normalized)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
  return { code: data.code as string, lines: parseSavedTripLines(data.lines) };
}

async function productTitle(db: any, productId: string): Promise<string> {
  const [{ data: product }, { data: translation }] = await Promise.all([
    db.from("products").select("internal_name, voucher_name").eq("id", productId).maybeSingle(),
    db
      .from("product_translations")
      .select("title")
      .eq("product_id", productId)
      .eq("language_code", MASTER_LANGUAGE)
      .maybeSingle(),
  ]);
  const display = product?.voucher_name?.trim();
  if (display) return display;
  if (translation?.title) return translation.title as string;
  return (product?.internal_name as string) ?? "Package";
}

/** Rebuilds a saved trip with today's prices. Never returns stored amounts. */
export async function readSavedTrip(code: string): Promise<SavedTripView | null> {
  const trip = await storedTrip(code);
  if (!trip) return null;

  const db = await admin();
  const fx = await fxContext();
  const { quoteDirectBooking } = await import("@/lib/direct-booking.server");
  const lines: SavedTripViewLine[] = [];

  for (const line of trip.lines) {
    if (line.kind === "catalogue_item") {
      let quote = null as Awaited<ReturnType<typeof quoteDirectBooking>>;
      try {
        quote = await quoteDirectBooking({
          catalogueId: line.catalogue_id,
          itemId: line.catalogue_item_id,
          choices: line.answers as never,
        });
      } catch {
        quote = null;
      }
      if (!quote) {
        lines.push({
          title: "Item",
          summary: [],
          total_idr: 0,
          blockers: ["This item is no longer available."],
          available: false,
        });
        continue;
      }
      const blockers = [...quote.issues];
      if (quote.total_idr == null || quote.total_idr <= 0) {
        blockers.push("This item has no price right now.");
      }
      lines.push({
        title: quote.item_name || "Item",
        summary: (quote.summary ?? []) as AnswerSummaryLine[],
        total_idr: quote.total_idr ?? 0,
        blockers,
        available: blockers.length === 0,
      });
      continue;
    }

    let quote: Awaited<ReturnType<typeof quotePackage>> | null = null;
    try {
      quote = await quotePackage({
        productId: line.product_id,
        answers: line.answers as PreviewValues,
        month: line.season_month,
        promoCode: line.promo_code,
        isGift: false,
      });
    } catch {
      quote = null;
    }
    if (!quote) {
      lines.push({
        title: "Package",
        summary: [],
        total_idr: 0,
        blockers: ["This part of the trip is no longer available."],
        available: false,
      });
      continue;
    }

    const blockers = [
      ...(quote.purchasable ? [] : ["This part of the trip is not available for booking."]),
      ...quote.configuration_issues,
      ...quote.errors,
    ];
    lines.push({
      title: await productTitle(db, line.product_id),
      summary: await orderedAnswerSummary(
        db,
        line.product_id,
        quote.answers as Record<string, unknown>,
        quote.catalogue_selections as never,
      ),
      total_idr: quote.total_idr,
      blockers,
      available: blockers.length === 0,
    });
  }

  const total = lines.reduce((sum, l) => sum + (l.available ? l.total_idr : 0), 0);
  return {
    code: trip.code,
    lines,
    total_idr: total,
    fx: toPublicFx(fx),
    customer_total: displayAmount(total, fx),
    bookable: lines.some((l) => l.available),
  };
}

/* ------------------------------------------------------------------ */
/* Load into the visitor's cart                                       */
/* ------------------------------------------------------------------ */

async function nextPosition(db: any, cartId: string): Promise<number> {
  const { data } = await db
    .from("cart_packages")
    .select("position")
    .eq("cart_id", cartId)
    .order("position", { ascending: false })
    .limit(1);
  return ((data?.[0]?.position as number | undefined) ?? -1) + 1;
}

/**
 * Recreates a saved trip in the visitor's own cart, re-priced live. Lines that
 * can no longer be booked are skipped and reported, never silently dropped.
 */
export async function loadSavedTripIntoCart(
  code: string,
  token?: string,
): Promise<{ loaded: number; skipped: string[] } | null> {
  const trip = await storedTrip(code);
  if (!trip) return null;

  const cart = (await currentCart(true, token))!;
  const db = await admin();
  const { addDirectBookingToCart } = await import("@/lib/direct-booking.server");

  let loaded = 0;
  const skipped: string[] = [];

  for (const line of trip.lines) {
    if (line.kind === "catalogue_item") {
      try {
        await addDirectBookingToCart({
          catalogueId: line.catalogue_id,
          itemId: line.catalogue_item_id,
          choices: line.answers as never,
          ...(token ? { token } : {}),
        });
        loaded += 1;
      } catch (e) {
        skipped.push(e instanceof Error ? e.message : "One item could not be added.");
      }
      continue;
    }

    let quote: Awaited<ReturnType<typeof quotePackage>> | null = null;
    try {
      quote = await quotePackage({
        productId: line.product_id,
        answers: line.answers as PreviewValues,
        month: line.season_month,
        promoCode: line.promo_code,
        isGift: false,
      });
    } catch {
      quote = null;
    }
    const title = quote ? await productTitle(db, line.product_id) : "One part of the trip";
    if (!quote || !quote.purchasable || quote.configuration_issues.length > 0 || quote.errors.length > 0) {
      skipped.push(`${title} is no longer available.`);
      continue;
    }

    const { data: inserted, error } = await db
      .from("packages")
      .insert({
        line_kind: "product",
        product_id: line.product_id,
        status: "complete",
        answers: quote.answers as never,
        resolved_inputs: quote.resolved_inputs as never,
        catalogue_selections: quote.catalogue_selections as never,
        quote_lines: quote.lines as never,
        subtotal_idr: quote.subtotal_idr,
        season_discount_idr: quote.season_discount_idr,
        promo_discount_idr: quote.promo_discount_idr,
        total_idr: quote.total_idr,
        season_month: quote.month,
        season_period: quote.season_period,
        promo_code: quote.promo_code,
        promo_code_id: quote.promo_code_id,
        quoted_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error || !inserted) {
      skipped.push(`${title} could not be added.`);
      continue;
    }

    const { error: linkError } = await db
      .from("cart_packages")
      .insert({
        cart_id: cart.id,
        package_id: inserted.id,
        position: await nextPosition(db, cart.id),
      });
    if (linkError) {
      await db.from("packages").delete().eq("id", inserted.id);
      skipped.push(`${title} could not be added.`);
      continue;
    }
    loaded += 1;
  }

  return { loaded, skipped };
}

/**
 * Purchase + Payment core. Server-only.
 *
 * CART -> SERVER REVALIDATION -> PURCHASE -> IMMUTABLE SNAPSHOT
 *      -> PAYMENT REQUEST -> PROVIDER -> PAYMENT CONFIRMATION
 *
 * Nothing here re-implements configuration, pricing, seasonality or promos:
 * every amount comes from the existing quote engine via quotePackage().
 */
import { getRequest } from "@tanstack/react-start/server";

import type { PreviewValues } from "@/lib/catalog";
import { currentCart, quotePackage, fail, CartError } from "@/lib/cart.server";
import {
  balanceFor,
  depositFor,
  parseFirstPaymentPercentage,
  purchaseStatusFor,
  type PaymentRequestKind,
} from "@/lib/purchase";
import {
  validateCustomerContact,
  type CustomerContact,
  type CustomerContactInput,
  type PurchaseFulfillmentStatus,
} from "@/lib/customer";
import { activePaymentProvider, providerByName } from "@/lib/payments/provider.server";
import { validateGift, type GiftData, type GiftInput } from "@/lib/voucher";
import { fxContext, freezeFx, displayAmount } from "@/lib/fx.server";
import { toPublicFx, type PublicFxContext } from "@/lib/fx.functions";
import { summarizeAnswers } from "@/lib/public-catalog";


export { CartError };

const SAFE_ERROR = "This action could not be completed. Please try again.";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function firstPaymentPercentage(db: any): Promise<number> {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", "first_payment_percentage")
    .maybeSingle();
  return parseFirstPaymentPercentage(data?.value);
}

function origin(): string {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Revalidation                                                        */
/* ------------------------------------------------------------------ */

export type RevalidatedPackage = {
  package_id: string;
  /** 'product' = configured package; 'catalogue_item' = direct booking. */
  line_kind: string;
  /** Null on direct catalogue bookings, which have no product. */
  product_id: string | null;
  product_title: string;
  /** Base amount configured in Pricing, before the customer's choices. */
  base_price_idr: number | null;
  /** The customer's choices with the real question labels they answered. */
  option_labels: { label: string; value: string }[];

  pricing_mode: string;
  answers: Record<string, unknown>;
  resolved_inputs: Record<string, unknown>;
  /** Catalogue items selected in this package, as resolved at quote time. */
  catalogue_selections: unknown[];
  lines: unknown;
  season_month: number | null;
  season_period: string | null;
  promo_code: string | null;
  subtotal_idr: number;
  season_discount_idr: number;
  promo_discount_idr: number;
  total_idr: number;
  /** Reasons this package cannot be purchased right now, in plain language. */
  blockers: string[];
  /** True when the stored quote no longer matches the recomputed price. */
  price_changed: boolean;
  previous_total_idr: number;
};

export type CheckoutRevalidation = {
  cart_id: string | null;
  packages: RevalidatedPackage[];
  total_idr: number;
  first_payment_percentage: number;
  first_payment_idr: number;
  outstanding_idr: number;
  blockers: string[];
  /** An already-created purchase for this cart, when checkout was completed. */
  existing_purchase_id: string | null;
  /** Customer currency context, resolved on the server for this request. */
  fx: PublicFxContext;
  /** Final amounts converted once into the customer currency. */
  customer_total: number;
  customer_first_payment: number;
  customer_outstanding: number;
};

async function orderFieldsByStep(db: any, productId: string, fields: any[]): Promise<any[]> {
  if (fields.length === 0) return fields;
  const { data: flow } = await db
    .from("config_flows")
    .select("id")
    .eq("product_id", productId)
    .maybeSingle();
  if (!flow) return fields;
  const { data: steps } = await db
    .from("steps")
    .select("id, display_order")
    .eq("flow_id", flow.id)
    .order("display_order");
  return sortFieldsByStepOrder(fields, (steps ?? []) as any[]);
}

/**
 * Recomputes every complete package in the cart from live configuration and
 * pricing. The client total is never trusted.
 */
export async function revalidateCart(token?: string): Promise<CheckoutRevalidation> {
  const db = await admin();
  const cart = await currentCart(false, token);
  const percentage = await firstPaymentPercentage(db);
  const fx = await fxContext();

  if (!cart) {
    return {
      cart_id: null,
      packages: [],
      total_idr: 0,
      first_payment_percentage: percentage,
      first_payment_idr: 0,
      outstanding_idr: 0,
      blockers: ["Your cart is empty."],
      existing_purchase_id: null,
      fx: toPublicFx(fx),
      customer_total: 0,
      customer_first_payment: 0,
      customer_outstanding: 0,
    };
  }

  const { data: rows } = await db
    .from("cart_packages")
    .select(
      "position, packages!inner(id, product_id, line_kind, catalogue_id, catalogue_item_id, item_title, status, answers, season_month, promo_code, total_idr)",
    )
    .eq("cart_id", cart.id)
    .order("position");

  const complete = (rows ?? [])
    .map((r: any) => r.packages)
    .filter((p: any) => p && p.status === "complete");

  const { data: purchase } = await db
    .from("purchases")
    .select("id")
    .eq("cart_id", cart.id)
    .maybeSingle();

  const packages: RevalidatedPackage[] = [];
  const blockers: string[] = [];

  const { revalidateDirectLine } = await import("@/lib/direct-booking.server");

  for (const pkg of complete) {
    // Direct catalogue bookings re-price from the live catalogue only; the
    // configurator, season and promo engines never see them.
    if (pkg.line_kind === "catalogue_item") {
      const direct = await revalidateDirectLine(pkg);
      const previousDirect = Number(pkg.total_idr);
      packages.push({
        package_id: pkg.id,
        line_kind: "catalogue_item",
        product_id: null,
        product_title: direct.title,
        base_price_idr: null,
        option_labels: (direct.summary ?? []) as { label: string; value: string }[],
        pricing_mode: "structured",

        answers: (pkg.answers ?? {}) as Record<string, unknown>,
        resolved_inputs: {},
        catalogue_selections: [],
        lines: direct.summary,
        season_month: null,
        season_period: null,
        promo_code: null,
        subtotal_idr: direct.total_idr,
        season_discount_idr: 0,
        promo_discount_idr: 0,
        total_idr: direct.total_idr,
        blockers: direct.blockers,
        price_changed: direct.blockers.length === 0 && direct.total_idr !== previousDirect,
        previous_total_idr: previousDirect,
      });
      blockers.push(...direct.blockers);
      continue;
    }

    const [{ data: product }, { data: translation }, { data: pricing }, { data: fieldRows }] =
      await Promise.all([
        db
          .from("products")
          .select("id, internal_name, voucher_name")
          .eq("id", pkg.product_id)
          .maybeSingle(),
        db
          .from("product_translations")
          .select("title")
          .eq("product_id", pkg.product_id)
          .eq("language_code", "en")
          .maybeSingle(),
        db
          .from("product_pricing")
          .select("mode, base_amount_idr")
          .eq("product_id", pkg.product_id)
          .maybeSingle(),
        db.from("fields").select("*").eq("product_id", pkg.product_id).order("display_order"),
      ]);

    // The voucher lists the customer's choices in configurator order: step by step.
    const orderedFields = await orderFieldsByStep(db, pkg.product_id, (fieldRows ?? []) as any[]);

    const optionRows = (fieldRows ?? []).length
      ? ((
          await db
            .from("field_options")
            .select("*")
            .in(
              "field_id",
              (fieldRows ?? []).map((f: any) => f.id),
            )
            .order("display_order")
        ).data ?? [])
      : [];


    const quote = await quotePackage({
      productId: pkg.product_id,
      answers: (pkg.answers ?? {}) as PreviewValues,
      month: pkg.season_month,
      promoCode: pkg.promo_code,
      isGift: false,
    });

    // The display name set on the product wins, so cart, order and voucher agree.
    const title =
      (product as any)?.voucher_name?.trim() || translation?.title || product?.internal_name || "Package";

    const own: string[] = [];
    if (!quote.purchasable) own.push(`${title} is no longer available to book.`);
    for (const issue of quote.configuration_issues) own.push(`${title}: ${issue}`);
    if (quote.errors.length > 0) own.push(`${title}: this package needs to be configured again.`);
    if (quote.promo_rejection) own.push(`${title}: ${quote.promo_rejection}`);

    const previous = Number(pkg.total_idr);
    packages.push({
      package_id: pkg.id,
      line_kind: "product",
      product_id: pkg.product_id,
      product_title: title,
      base_price_idr:
        pricing?.base_amount_idr == null ? null : Number(pricing.base_amount_idr),
      option_labels: summarizeAnswers(
        orderedFields as never,
        optionRows as never,
        (pkg.answers ?? {}) as PreviewValues,
        Object.fromEntries(
          ((quote.catalogue_selections ?? []) as any[]).map((c) => [c.item_id, c.name]),
        ),
      ),
      pricing_mode: pricing?.mode ?? "structured",

      answers: (pkg.answers ?? {}) as Record<string, unknown>,
      resolved_inputs: quote.resolved_inputs as Record<string, unknown>,
      catalogue_selections: quote.catalogue_selections,
      lines: quote.lines,
      season_month: quote.month,
      season_period: quote.season_period,
      promo_code: quote.promo_code,
      subtotal_idr: quote.subtotal_idr,
      season_discount_idr: quote.season_discount_idr,
      promo_discount_idr: quote.promo_discount_idr,
      total_idr: quote.total_idr,
      blockers: own,
      price_changed: own.length === 0 && quote.total_idr !== previous,
      previous_total_idr: previous,
    });
    blockers.push(...own);
  }

  if (packages.length === 0) blockers.push("Your cart is empty.");

  const total = packages.reduce((sum, p) => sum + p.total_idr, 0);
  const deposit = depositFor(total, percentage);

  return {
    cart_id: cart.id,
    packages,
    total_idr: total,
    first_payment_percentage: percentage,
    first_payment_idr: deposit,
    outstanding_idr: balanceFor(total, deposit),
    blockers,
    existing_purchase_id: purchase?.id ?? null,
    fx: toPublicFx(fx),
    // Conversion happens once, on the final amounts only.
    customer_total: displayAmount(total, fx),
    customer_first_payment: displayAmount(deposit, fx),
    customer_outstanding: displayAmount(balanceFor(total, deposit), fx),
  };
}

/**
 * Refreshes the stored package quotes so the cart matches the revalidation
 * the customer just saw. Prices are only ever written by the server.
 */
async function syncPackageQuotes(revalidation: CheckoutRevalidation) {
  const db = await admin();
  for (const p of revalidation.packages) {
    if (!p.price_changed) continue;
    await db
      .from("packages")
      .update({
        subtotal_idr: p.subtotal_idr,
        season_discount_idr: p.season_discount_idr,
        promo_discount_idr: p.promo_discount_idr,
        total_idr: p.total_idr,
        season_period: p.season_period,
        quoted_at: new Date().toISOString(),
      })
      .eq("id", p.package_id);
  }
}

/* ------------------------------------------------------------------ */
/* Purchase creation                                                   */
/* ------------------------------------------------------------------ */

function buildSnapshot(
  revalidation: CheckoutRevalidation,
  customer: CustomerContact,
  gift: GiftData,
  frozen: ReturnType<typeof freezeFx>,
  riskAcceptedAt: string,
) {
  return {
    snapshot_version: 1,
    taken_at: new Date().toISOString(),
    currency_code: "IDR",
    first_payment_percentage: revalidation.first_payment_percentage,
    first_payment_idr: revalidation.first_payment_idr,
    outstanding_idr: revalidation.outstanding_idr,
    total_idr: revalidation.total_idr,
    // Exchange information frozen at purchase time. IDR stays authoritative;
    // these values are never recalculated from a later rate.
    fx: frozen
      ? {
          customer_currency_code: frozen.customer_currency_code,
          rate: frozen.fx_rate,
          rate_effective_at: frozen.fx_effective_at,
          customer_total_amount: frozen.customer_total_amount,
          customer_first_payment_amount: frozen.customer_first_payment_amount,
          customer_outstanding_amount: frozen.customer_outstanding_amount,
        }
      : null,
    packages: revalidation.packages.map((p) => ({
      package_id: p.package_id,
      product_id: p.product_id,
      product_title: p.product_title,
      base_price_idr: p.base_price_idr,
      option_labels: p.option_labels,

      pricing_mode: p.pricing_mode,
      answers: p.answers,
      resolved_inputs: p.resolved_inputs,
      catalogue_selections: p.catalogue_selections,
      quote_lines: p.lines,
      season_month: p.season_month,
      season_period: p.season_period,
      promo_code: p.promo_code,
      subtotal_idr: p.subtotal_idr,
      season_discount_idr: p.season_discount_idr,
      promo_discount_idr: p.promo_discount_idr,
      total_idr: p.total_idr,
    })),
    // The contact as agreed at purchase time; later profile edits never
    // rewrite this historical record.
    customer: {
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      country: customer.country,
      preferred_language_code: customer.preferred_language_code,
    },
    // Gift intent as agreed at purchase time. The voucher engine reads this.
    gift: {
      is_gift: gift.is_gift,
      recipient_name: gift.gift_recipient_name,
      message: gift.gift_message,
    },
    // The conditions the customer accepted before paying, kept historically.
    risk: { accepted: true, accepted_at: riskAcceptedAt },
  };
}

export type PurchaseView = {
  id: string;
  reference: string | null;
  status: string;
  fulfillment_status: PurchaseFulfillmentStatus;
  currency_code: string;
  total_idr: number;
  first_payment_percentage: number;
  first_payment_idr: number;
  outstanding_idr: number;
  paid_idr: number;
  created_at: string;
  /** Frozen customer currency, null for purchases taken in Rupiah. */
  customer_currency_code: string | null;
  fx_rate: string | null;
  fx_effective_at: string | null;
  customer_total_amount: number | null;
  customer_first_payment_amount: number | null;
  customer_outstanding_amount: number | null;
  payment: {
    id: string;
    kind: PaymentRequestKind;
    status: string;
    amount_idr: number;
    provider: string | null;
    payment_url: string | null;
    customer_currency_code: string | null;
    customer_amount: number | null;
  } | null;
  snapshot: any;
};

async function loadPurchase(purchaseId: string): Promise<PurchaseView | null> {
  const db = await admin();
  const { data: purchase } = await db
    .from("purchases")
    .select(
      "id, reference, status, fulfillment_status, currency_code, total_idr, first_payment_percentage, first_payment_idr, outstanding_idr, paid_idr, created_at, customer_currency_code, fx_rate, fx_effective_at, customer_total_amount, customer_first_payment_amount, customer_outstanding_amount",
    )
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return null;

  const [{ data: requests }, { data: snapshot }] = await Promise.all([
    db
      .from("payment_requests")
      .select(
        "id, kind, status, amount_idr, provider, provider_payment_url, created_at, customer_currency_code, fx_rate, customer_amount",
      )
      .eq("purchase_id", purchaseId)
      .order("created_at", { ascending: false }),
    db.from("purchase_snapshots").select("data").eq("purchase_id", purchaseId).maybeSingle(),
  ]);

  const open =
    (requests ?? []).find((r: any) => r.status === "created" || r.status === "pending") ??
    (requests ?? [])[0] ??
    null;

  return {
    ...purchase,
    total_idr: Number(purchase.total_idr),
    first_payment_percentage: Number(purchase.first_payment_percentage),
    first_payment_idr: Number(purchase.first_payment_idr),
    outstanding_idr: Number(purchase.outstanding_idr),
    paid_idr: Number(purchase.paid_idr),
    customer_currency_code: purchase.customer_currency_code ?? null,
    fx_rate: purchase.fx_rate != null ? String(purchase.fx_rate) : null,
    fx_effective_at: purchase.fx_effective_at ?? null,
    customer_total_amount:
      purchase.customer_total_amount != null ? Number(purchase.customer_total_amount) : null,
    customer_first_payment_amount:
      purchase.customer_first_payment_amount != null
        ? Number(purchase.customer_first_payment_amount)
        : null,
    customer_outstanding_amount:
      purchase.customer_outstanding_amount != null
        ? Number(purchase.customer_outstanding_amount)
        : null,
    payment: open
      ? {
          id: open.id,
          kind: open.kind,
          status: open.status,
          amount_idr: Number(open.amount_idr),
          provider: open.provider,
          payment_url: open.provider_payment_url,
          customer_currency_code: open.customer_currency_code ?? null,
          customer_amount: open.customer_amount != null ? Number(open.customer_amount) : null,
        }
      : null,
    snapshot: snapshot?.data ?? null,
  };
}

export async function getPurchase(purchaseId: string) {
  const purchase = await loadPurchase(purchaseId);

  // If the purchase has an open, unpaid payment request with no provider link
  // yet, try to generate one now. A link may be missing because the provider
  // was not configured when the booking was made, or because a transient
  // failure happened during checkout. Returning to the booking page is the
  // natural place to recover; failures here never break the view.
  if (
    purchase?.payment &&
    !purchase.payment.payment_url &&
    purchase.payment.status !== "paid"
  ) {
    await ensurePaymentLink(purchaseId, purchase.payment.kind).catch(
      () => undefined,
    );
    return loadPurchase(purchaseId);
  }

  return purchase;
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Finds the existing contact for this email or creates one. Email is the
 * conservative identity key: the same person booking twice keeps one record.
 * Freshly supplied name/phone/country/language refresh the contact, while
 * every past purchase keeps its own historical snapshot of the contact.
 */
export async function findOrCreateCustomer(contact: CustomerContact): Promise<string> {
  const db = await admin();
  const { data: existing } = await db
    .from("customers")
    .select("id")
    .eq("email", contact.email)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from("customers")
      .update({
        full_name: contact.full_name,
        phone: contact.phone,
        country: contact.country,
        preferred_language_code: contact.preferred_language_code,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await db
    .from("customers")
    .insert(contact as never)
    .select("id")
    .single();
  if (error || !created) {
    // A concurrent checkout may have inserted the same email first.
    const { data: retry } = await db
      .from("customers")
      .select("id")
      .eq("email", contact.email)
      .maybeSingle();
    if (retry?.id) return retry.id as string;
    fail(SAFE_ERROR);
  }
  return created.id as string;
}

/**
 * Converts the cart into one Purchase, one immutable snapshot and the first
 * payment request, in a single database transaction. Repeating the call for
 * the same cart returns the same purchase — never a second one.
 */
export async function createPurchaseFromCart(
  contactInput: CustomerContactInput,
  giftInput?: GiftInput,
  token?: string,
  options?: { risk_accepted?: boolean },
) {
  const db = await admin();
  const revalidation = await revalidateCart(token);
  if (!revalidation.cart_id) fail("Your cart could not be found.");

  if (revalidation.existing_purchase_id) {
    // Returning or refreshing never creates a second purchase; the same
    // pending payment link is reused.
    await ensurePaymentLink(revalidation.existing_purchase_id, "first_payment").catch(
      () => undefined,
    );
    return {
      purchase: await loadPurchase(revalidation.existing_purchase_id),
      revalidation,
      reused: true,
    };
  }

  // The conditions must be accepted before any money is requested.
  if (options?.risk_accepted !== true) fail("Please accept the booking conditions to continue.");

  const hard = revalidation.blockers;
  if (hard.length > 0) fail(hard[0]!);
  if (revalidation.total_idr <= 0) fail("This booking has no amount to pay.");

  // Contact and gift details are validated on the server; nothing the browser
  // sends about identity or money is trusted.
  const contact = validateCustomerContact(contactInput);
  const gift = validateGift(giftInput);
  const customerId = await findOrCreateCustomer(contact);

  // FX is frozen here, from the same rate the customer was just shown.
  const fx = await fxContext(revalidation.fx.currency_code);
  const frozen = freezeFx(fx, revalidation.total_idr, revalidation.first_payment_idr);

  const { data: purchaseId, error } = await db.rpc("create_purchase", {
    _cart_id: revalidation.cart_id,
    _customer_id: customerId,
    _total_idr: revalidation.total_idr,
    _percentage: revalidation.first_payment_percentage,
    _first_payment_idr: revalidation.first_payment_idr,
    _outstanding_idr: revalidation.outstanding_idr,
    _snapshot: buildSnapshot(
      revalidation,
      contact,
      gift,
      frozen,
      new Date().toISOString(),
    ) as never,
    _is_gift: gift.is_gift,
    _gift_recipient_name: gift.gift_recipient_name,
    _gift_message: gift.gift_message,
  });
  if (error || !purchaseId) fail(SAFE_ERROR);

  if (frozen) {
    await db.from("purchases").update(frozen).eq("id", purchaseId as string);
    await db
      .from("payment_requests")
      .update({
        customer_currency_code: frozen.customer_currency_code,
        fx_rate: frozen.fx_rate,
        customer_amount: frozen.customer_first_payment_amount,
      })
      .eq("purchase_id", purchaseId as string)
      .eq("kind", "first_payment");
  }

  await syncPackageQuotes(revalidation);

  // The payment link is a provider concern and never blocks the Purchase.
  await ensurePaymentLink(purchaseId as string, "first_payment").catch(() => undefined);

  return { purchase: await loadPurchase(purchaseId as string), revalidation, reused: false };
}

/* ------------------------------------------------------------------ */
/* Admin purchase management                                           */
/* ------------------------------------------------------------------ */

/** Sets the operational state only; commercial/payment state is untouched. */
export async function setFulfillmentStatus(
  purchaseId: string,
  status: PurchaseFulfillmentStatus,
) {
  const db = await admin();
  const { error } = await db
    .from("purchases")
    .update({ fulfillment_status: status })
    .eq("id", purchaseId);
  if (error) fail(SAFE_ERROR);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Payment requests                                                    */
/* ------------------------------------------------------------------ */

/** Creates or refreshes the provider payment link for one payment request. */
export async function ensurePaymentLink(purchaseId: string, kind: PaymentRequestKind) {
  const db = await admin();
  const { data: request } = await db
    .from("payment_requests")
    .select("id, kind, status, amount_idr, currency_code, provider, provider_payment_url")
    .eq("purchase_id", purchaseId)
    .eq("kind", kind)
    .in("status", ["created", "pending", "paid"])
    .maybeSingle();
  if (!request) return null;
  if (request.status === "paid") return request;
  if (request.provider_payment_url) return request;

  const provider = await activePaymentProvider();
  if (!provider) return request;

  const link = await provider.createPaymentLink({
    paymentRequestId: request.id,
    purchaseId,
    amountIdr: Number(request.amount_idr),
    currencyCode: request.currency_code,
    description:
      kind === "first_payment" ? "Cimaja Boardriders booking deposit" : "Cimaja Boardriders balance",
    returnUrl: `${origin()}/purchase/${purchaseId}`,
  });

  const { data: updated } = await db
    .from("payment_requests")
    .update({
      status: "pending",
      provider: link.provider,
      provider_reference: link.reference,
      provider_payment_url: link.url,
      expires_at: link.expiresAt,
    })
    .eq("id", request.id)
    .select("id, kind, status, amount_idr, currency_code, provider, provider_payment_url")
    .single();
  return updated ?? request;
}

/** Admin-triggered collection of the remaining balance on the same purchase. */
export async function createBalanceRequest(purchaseId: string) {
  const db = await admin();
  const { data: purchase } = await db
    .from("purchases")
    .select(
      "id, outstanding_idr, status, customer_currency_code, fx_rate, customer_outstanding_amount",
    )
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) fail("This purchase could not be found.");
  if (Number(purchase.outstanding_idr) <= 0) fail("There is no outstanding balance on this purchase.");

  const { data: existing } = await db
    .from("payment_requests")
    .select("id")
    .eq("purchase_id", purchaseId)
    .eq("kind", "balance")
    .in("status", ["created", "pending", "paid"])
    .maybeSingle();

  if (!existing) {
    const { error } = await db.from("payment_requests").insert({
      purchase_id: purchaseId,
      kind: "balance",
      amount_idr: Number(purchase.outstanding_idr),
      // The historical rate agreed at purchase time, never today's rate.
      customer_currency_code: purchase.customer_currency_code ?? null,
      fx_rate: purchase.fx_rate ?? null,
      customer_amount:
        purchase.customer_outstanding_amount != null
          ? Number(purchase.customer_outstanding_amount)
          : null,
    });
    if (error) fail(SAFE_ERROR);
  }
  return ensurePaymentLink(purchaseId, "balance");
}

/* ------------------------------------------------------------------ */
/* Payment confirmation (provider notifications)                       */
/* ------------------------------------------------------------------ */

/** Recomputes purchase money from confirmed payment requests only. */
async function recomputePurchaseMoney(purchaseId: string) {
  const db = await admin();
  const [{ data: purchase }, { data: requests }] = await Promise.all([
    db.from("purchases").select("id, total_idr, status").eq("id", purchaseId).maybeSingle(),
    db.from("payment_requests").select("amount_idr, status").eq("purchase_id", purchaseId),
  ]);
  if (!purchase) return;
  const paid = (requests ?? [])
    .filter((r: any) => r.status === "paid")
    .reduce((sum: number, r: any) => sum + Number(r.amount_idr), 0);
  const total = Number(purchase.total_idr);
  const status = purchase.status === "cancelled" ? "cancelled" : purchaseStatusFor(total, paid);
  await db.from("purchases").update({ paid_idr: Math.min(paid, total), status }).eq("id", purchaseId);
}

/**
 * Applies one provider notification. Every notification is stored once per
 * provider event id, so replays and duplicates are inert.
 */
export async function applyProviderNotification(
  providerName: string,
  headers: Headers,
  rawBody: string,
): Promise<{ ok: boolean; duplicate: boolean; reason?: string }> {
  const provider = await providerByName(providerName);
  if (!provider) return { ok: false, duplicate: false, reason: "unknown_provider" };
  if (!provider.verifyNotification(headers)) return { ok: false, duplicate: false, reason: "unverified" };

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { ok: false, duplicate: false, reason: "invalid_payload" };
  }

  const event = provider.parseNotification(payload);
  if (!event) return { ok: false, duplicate: false, reason: "invalid_payload" };

  const db = await admin();
  const { data: request } = event.paymentRequestId
    ? await db
        .from("payment_requests")
        .select("id, purchase_id, status, amount_idr")
        .eq("id", event.paymentRequestId)
        .maybeSingle()
    : event.reference
      ? await db
          .from("payment_requests")
          .select("id, purchase_id, status, amount_idr")
          .eq("provider", provider.name)
          .eq("provider_reference", event.reference)
          .maybeSingle()
      : { data: null };

  const { error: insertError } = await db.from("payment_events").insert({
    payment_request_id: request?.id ?? null,
    provider: provider.name,
    provider_event_id: event.eventId,
    event_type: event.eventType,
    payload: payload as never,
  });
  // Unique (provider, provider_event_id): a repeat is recorded once and ignored.
  if (insertError) return { ok: true, duplicate: true };

  if (!request) return { ok: true, duplicate: false, reason: "unmatched" };
  if (request.status === "paid") return { ok: true, duplicate: false };

  const next =
    event.status === "paid"
      ? "paid"
      : event.status === "expired"
        ? "expired"
        : event.status === "failed"
          ? "failed"
          : event.status === "cancelled"
            ? "cancelled"
            : "pending";

  await db
    .from("payment_requests")
    .update({ status: next, paid_at: next === "paid" ? new Date().toISOString() : null })
    .eq("id", request.id);

  await recomputePurchaseMoney(request.purchase_id);

  // A confirmed payment is what entitles the customer: issue one voucher per
  // purchased package, idempotently. A provider replay never produces a
  // second voucher for the same package.
  if (next === "paid") {
    const { issueVouchersForPurchase } = await import("@/lib/voucher.server");
    await issueVouchersForPurchase(request.purchase_id).catch(() => undefined);

    // Document + email are separate stages: a delivery failure never rolls back
    // the payment, the purchase or the vouchers.
    const { deliverVouchersForPurchase } = await import("@/lib/voucher-delivery.server");
    await deliverVouchersForPurchase(request.purchase_id).catch(() => undefined);
  }


  return { ok: true, duplicate: false };
}

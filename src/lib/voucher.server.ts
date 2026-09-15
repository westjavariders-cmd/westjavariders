/**
 * Voucher engine. Server-only.
 *
 * PURCHASE (+ immutable snapshot) -> CONFIRMED PAYMENT -> VOUCHER
 *
 * One engine serves standard and gift vouchers. Nothing here prices,
 * discounts or re-quotes: the entitlement is rendered from the existing
 * Purchase Snapshot, and money/status come from the existing Purchase.
 */
import { fail } from "@/lib/cart.server";
import {
  buildEntitlement,
  parseValidityMonths,
  redemptionCheck,
  type VoucherStatus,
  type VoucherType,
} from "@/lib/voucher";

const SAFE_ERROR = "This action could not be completed. Please try again.";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function validityMonths(db: any): Promise<number> {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", "voucher_validity_months")
    .maybeSingle();
  return parseValidityMonths(data?.value);
}

async function purchaseWithSnapshot(db: any, purchaseId: string) {
  const [{ data: purchase }, { data: snapshot }] = await Promise.all([
    db
      .from("purchases")
      .select(
        "id, reference, status, total_idr, paid_idr, created_at, customer_id, is_gift, gift_recipient_name, gift_message",
      )
      .eq("id", purchaseId)
      .maybeSingle(),
    db.from("purchase_snapshots").select("data").eq("purchase_id", purchaseId).maybeSingle(),
  ]);
  return { purchase, snapshot: snapshot?.data ?? null };
}

async function entitlementFor(db: any, purchase: any, snapshot: any, packageId: string | null) {
  const type: VoucherType = purchase.is_gift ? "GIFT" : "STANDARD";
  const { withOrderedSnapshotAnswers } = await import("@/lib/answer-summary.server");
  const orderedSnapshot = await withOrderedSnapshotAnswers(db, snapshot);
  return buildEntitlement({
    snapshot: orderedSnapshot,
    voucherType: type,
    purchaseReference: purchase.reference ?? null,
    purchaseCreatedAt: purchase.created_at ?? null,
    packageId,
    totalIdr: Number(purchase.total_idr),
    paidIdr: Number(purchase.paid_idr),
    recipientName: purchase.gift_recipient_name ?? null,
    giftMessage: purchase.gift_message ?? null,
  });
}

/** The purchased Packages of a Purchase, read from the immutable snapshot. */
function snapshotPackageIds(snapshot: any): string[] {
  const rows: any[] = Array.isArray(snapshot?.packages) ? snapshot.packages : [];
  const ids: string[] = [];
  for (const row of rows) {
    const id = row?.package_id;
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/* Voucher at Add to Cart                                              */
/* ------------------------------------------------------------------ */

const CART_LINE_FIELDS =
  "id, product_id, line_kind, item_title, answers, resolved_inputs, catalogue_selections, quote_lines, subtotal_idr, season_discount_idr, promo_discount_idr, total_idr, season_month, season_period, promo_code, created_at";

async function cartLineTitle(db: any, line: any): Promise<string> {
  if (line.line_kind === "catalogue_item") return line.item_title ?? "Booking";
  const { data: product } = await db
    .from("products")
    .select("internal_name, voucher_name")
    .eq("id", line.product_id)
    .maybeSingle();
  if (product?.voucher_name) return product.voucher_name;
  const { data: translation } = await db
    .from("product_translations")
    .select("title")
    .eq("product_id", line.product_id)
    .eq("language_code", "en")
    .maybeSingle();
  return translation?.title ?? product?.internal_name ?? "Experience";
}

/** Configuration and prices of one cart line, in the snapshot shape. */
async function cartSnapshot(db: any, line: any) {
  const title = await cartLineTitle(db, line);
  let optionLabels: unknown[] = [];
  let basePrice: number | null = null;

  if (line.line_kind === "catalogue_item") {
    optionLabels = Array.isArray(line.quote_lines) ? line.quote_lines : [];
  } else {
    const { orderedAnswerSummary } = await import("@/lib/answer-summary.server");
    optionLabels = await orderedAnswerSummary(
      db,
      line.product_id,
      (line.answers ?? {}) as Record<string, unknown>,
      (line.catalogue_selections ?? []) as any[],
    );
    const { data: pricing } = await db
      .from("product_pricing")
      .select("base_amount_idr")
      .eq("product_id", line.product_id)
      .maybeSingle();
    const base = Number(pricing?.base_amount_idr);
    basePrice = Number.isFinite(base) ? base : null;
  }

  return {
    snapshot_version: 1,
    stage: "cart",
    taken_at: new Date().toISOString(),
    currency_code: "IDR",
    total_idr: Number(line.total_idr),
    packages: [
      {
        package_id: line.id,
        product_id: line.product_id,
        product_title: title,
        base_price_idr: basePrice,
        option_labels: optionLabels,
        answers: line.answers ?? {},
        resolved_inputs: line.resolved_inputs ?? {},
        catalogue_selections: line.catalogue_selections ?? [],
        quote_lines: line.quote_lines ?? [],
        season_month: line.season_month ?? null,
        season_period: line.season_period ?? null,
        promo_code: line.promo_code ?? null,
        subtotal_idr: Number(line.subtotal_idr ?? line.total_idr),
        season_discount_idr: Number(line.season_discount_idr ?? 0),
        promo_discount_idr: Number(line.promo_discount_idr ?? 0),
        total_idr: Number(line.total_idr),
      },
    ],
    customer: null,
    gift: { is_gift: false, recipient_name: null, message: null },
  };
}

/**
 * Creates the UNPAID voucher of a cart line the moment it is added to the
 * cart. The number is consumed once and never reused; a repeated call returns
 * the same voucher. Nothing here prices or re-quotes: it reads the line the
 * cart already priced server-side.
 */
export async function ensureVoucherForCartLine(
  packageId: string,
  cartId: string | null,
): Promise<{ voucher: any | null; created: boolean }> {
  const db = await admin();

  const { data: existing } = await db
    .from("vouchers")
    .select("*")
    .eq("package_id", packageId)
    .maybeSingle();
  if (existing) return { voucher: existing, created: false };

  const { data: line } = await db
    .from("packages")
    .select(CART_LINE_FIELDS)
    .eq("id", packageId)
    .maybeSingle();
  if (!line) return { voucher: null, created: false };

  const months = await validityMonths(db);
  const snapshot = await cartSnapshot(db, line);
  const entitlement = buildEntitlement({
    snapshot,
    voucherType: "STANDARD",
    purchaseReference: null,
    purchaseCreatedAt: line.created_at ?? null,
    packageId,
    totalIdr: Number(line.total_idr),
    paidIdr: 0,
    recipientName: null,
    giftMessage: null,
  });

  const { data: code, error: codeError } = await db.rpc("next_voucher_code");
  if (codeError || !code) return { voucher: null, created: false };

  const validUntil = new Date();
  validUntil.setUTCMonth(validUntil.getUTCMonth() + months);

  const { data: voucher, error } = await db
    .from("vouchers")
    .insert({
      code,
      purchase_id: null,
      package_id: packageId,
      cart_id: cartId,
      cart_snapshot: snapshot as never,
      status: "UNPAID",
      voucher_type: "STANDARD",
      validity_months: months,
      valid_until: validUntil.toISOString(),
      entitlement: entitlement as never,
    })
    .select("*")
    .single();

  if (error || !voucher) {
    // A concurrent add already consumed the number for this line.
    const { data: raced } = await db.from("vouchers").select("*").eq("package_id", packageId).maybeSingle();
    return { voucher: raced ?? null, created: false };
  }
  return { voucher, created: true };
}

/**
 * Issues one voucher per purchased Package once the required payment is
 * confirmed. Idempotent: repeated calls (payment replays, Admin retries)
 * return the same vouchers with the same numbers, and the database enforces
 * one voucher per package. A voucher already created at Add to Cart is
 * adopted — its number never changes.
 */
export async function issueVouchersForPurchase(
  purchaseId: string,
): Promise<{ vouchers: any[]; reason?: string; created: number }> {
  const db = await admin();

  const { purchase, snapshot } = await purchaseWithSnapshot(db, purchaseId);
  if (!purchase) return { vouchers: [], reason: "purchase_not_found", created: 0 };
  if (purchase.status === "cancelled")
    return { vouchers: [], reason: "purchase_cancelled", created: 0 };
  if (Number(purchase.paid_idr) <= 0)
    return { vouchers: [], reason: "payment_not_confirmed", created: 0 };

  const packageIds = snapshotPackageIds(snapshot);
  if (packageIds.length === 0) return { vouchers: [], reason: "no_packages", created: 0 };

  const months = await validityMonths(db);
  let created = 0;

  for (const packageId of packageIds) {
    const { data: existing } = await db
      .from("vouchers")
      .select("id, status, purchase_id")
      .eq("package_id", packageId)
      .maybeSingle();

    // A voucher created at Add to Cart keeps its number: payment only links it
    // to the purchase, refreshes its historical representation and marks PAID.
    if (existing) {
      const validUntil = new Date();
      validUntil.setUTCMonth(validUntil.getUTCMonth() + months);
      const patch: Record<string, unknown> = {
        purchase_id: purchaseId,
        entitlement: (await entitlementFor(db, purchase, snapshot, packageId)) as never,
        voucher_type: purchase.is_gift ? "GIFT" : "STANDARD",
        customer_id: purchase.customer_id ?? null,
        gift_recipient_name: purchase.is_gift ? (purchase.gift_recipient_name ?? null) : null,
        gift_message: purchase.is_gift ? (purchase.gift_message ?? null) : null,
      };
      if (existing.status === "UNPAID") {
        patch["status"] = "PAID";
        patch["issued_at"] = new Date().toISOString();
        patch["validity_months"] = months;
        patch["valid_until"] = validUntil.toISOString();
      }
      const { error: adoptError } = await db.from("vouchers").update(patch).eq("id", existing.id);
      if (adoptError) return { vouchers: [], reason: "issue_failed", created };
      continue;
    }

    const { data: voucherId, error } = await db.rpc("issue_voucher", {
      _purchase_id: purchaseId,
      _package_id: packageId,
      _validity_months: months,
      _entitlement: await entitlementFor(db, purchase, snapshot, packageId) as never,
    });
    if (error || !voucherId) return { vouchers: [], reason: "issue_failed", created };
    created += 1;
  }

  const { data: vouchers } = await db
    .from("vouchers")
    .select("*")
    .eq("purchase_id", purchaseId)
    .order("code");

  return { vouchers: vouchers ?? [], created };
}

/**
 * Rebuilds the customer-facing representation from the snapshot. The voucher
 * number, purchase link, package link, validity and status never change.
 */
export async function regenerateRepresentation(voucherId: string) {
  const db = await admin();
  const { data: voucher } = await db
    .from("vouchers")
    .select("id, purchase_id, package_id, representation_version, cart_snapshot, status")
    .eq("id", voucherId)
    .maybeSingle();
  if (!voucher) fail("This voucher could not be found.");

  // An unpaid voucher has no purchase yet: it is rebuilt from the cart-stage
  // configuration it was created with.
  if (!voucher.purchase_id) {
    const { error: cartError } = await db
      .from("vouchers")
      .update({
        entitlement: buildEntitlement({
          snapshot: voucher.cart_snapshot ?? {},
          voucherType: "STANDARD",
          purchaseReference: null,
          purchaseCreatedAt: null,
          packageId: voucher.package_id,
          totalIdr: Number((voucher.cart_snapshot as any)?.total_idr ?? 0),
          paidIdr: 0,
          recipientName: null,
          giftMessage: null,
        }) as never,
        representation_version: Number(voucher.representation_version) + 1,
      })
      .eq("id", voucherId);
    if (cartError) fail(SAFE_ERROR);
    return { ok: true };
  }

  const { purchase, snapshot } = await purchaseWithSnapshot(db, voucher.purchase_id);
  if (!purchase) fail("This voucher could not be found.");

  const { error } = await db
    .from("vouchers")
    .update({
      entitlement: await entitlementFor(db, purchase, snapshot, voucher.package_id) as never,
      representation_version: Number(voucher.representation_version) + 1,
    })
    .eq("id", voucherId);
  if (error) fail(SAFE_ERROR);
  return { ok: true };
}


/** Admin redemption. Single-use: a used voucher can never be used again. */
export async function markVoucherUsed(voucherId: string, actorId: string, note?: string | null) {
  const db = await admin();
  const { data: voucher } = await db
    .from("vouchers")
    .select("id, code, purchase_id, status, valid_until")
    .eq("id", voucherId)
    .maybeSingle();

  const check = redemptionCheck(voucher as any);
  if (!check.ok) {
    // Keep the stored status truthful when validity has simply run out.
    if (check.effectiveStatus === "EXPIRED" && (voucher?.status === "ACTIVE" || voucher?.status === "PAID")) {
      await db.from("vouchers").update({ status: "EXPIRED" }).eq("id", voucherId);
    }
    fail(check.reason ?? "This voucher cannot be used.");
  }

  const { error } = await db
    .from("vouchers")
    .update({
      status: "USED" satisfies VoucherStatus,
      redeemed_at: new Date().toISOString(),
      redeemed_by: actorId,
      redemption_note: note?.trim() ? note.trim().slice(0, 300) : null,
    })
    .eq("id", voucherId)
    .in("status", ["ACTIVE", "PAID"]);
  if (error) fail(SAFE_ERROR);
  return { ok: true };
}

/** Cancels the voucher only. The historical Purchase is never touched. */
export async function cancelVoucher(voucherId: string, note?: string | null) {
  const db = await admin();
  const { data: voucher } = await db
    .from("vouchers")
    .select("id, status")
    .eq("id", voucherId)
    .maybeSingle();
  if (!voucher) fail("This voucher could not be found.");
  if (voucher.status === "USED") fail("A used voucher cannot be cancelled.");
  if (voucher.status === "CANCELLED") return { ok: true };

  const { error } = await db
    .from("vouchers")
    .update({
      status: "CANCELLED" satisfies VoucherStatus,
      cancelled_at: new Date().toISOString(),
      redemption_note: note?.trim() ? note.trim().slice(0, 300) : null,
    })
    .eq("id", voucherId);
  if (error) fail(SAFE_ERROR);
  return { ok: true };
}

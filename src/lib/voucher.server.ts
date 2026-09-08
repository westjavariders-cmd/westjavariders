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

function entitlementFor(purchase: any, snapshot: any) {
  const type: VoucherType = purchase.is_gift ? "GIFT" : "STANDARD";
  return buildEntitlement({
    snapshot,
    voucherType: type,
    purchaseReference: purchase.reference ?? null,
    purchaseCreatedAt: purchase.created_at ?? null,
    totalIdr: Number(purchase.total_idr),
    paidIdr: Number(purchase.paid_idr),
    recipientName: purchase.gift_recipient_name ?? null,
    giftMessage: purchase.gift_message ?? null,
  });
}

/**
 * Issues the voucher for a purchase once the required payment is confirmed.
 * Idempotent: repeated calls (payment replays, Admin retries) return the same
 * voucher with the same number.
 */
export async function issueVoucherForPurchase(
  purchaseId: string,
): Promise<{ voucher: any | null; reason?: string; created: boolean }> {
  const db = await admin();

  const { data: existing } = await db
    .from("vouchers")
    .select("*")
    .eq("purchase_id", purchaseId)
    .maybeSingle();
  if (existing) return { voucher: existing, created: false };

  const { purchase, snapshot } = await purchaseWithSnapshot(db, purchaseId);
  if (!purchase) return { voucher: null, reason: "purchase_not_found", created: false };
  if (purchase.status === "cancelled")
    return { voucher: null, reason: "purchase_cancelled", created: false };
  if (Number(purchase.paid_idr) <= 0)
    return { voucher: null, reason: "payment_not_confirmed", created: false };

  const months = await validityMonths(db);

  const { data: voucherId, error } = await db.rpc("issue_voucher", {
    _purchase_id: purchaseId,
    _validity_months: months,
    _entitlement: entitlementFor(purchase, snapshot) as never,
  });
  if (error || !voucherId) return { voucher: null, reason: "issue_failed", created: false };

  const { data: voucher } = await db.from("vouchers").select("*").eq("id", voucherId).maybeSingle();
  return { voucher, created: true };
}

/**
 * Rebuilds the customer-facing representation from the snapshot. The voucher
 * number, purchase link, validity and status never change.
 */
export async function regenerateRepresentation(voucherId: string) {
  const db = await admin();
  const { data: voucher } = await db
    .from("vouchers")
    .select("id, purchase_id, representation_version")
    .eq("id", voucherId)
    .maybeSingle();
  if (!voucher) fail("This voucher could not be found.");

  const { purchase, snapshot } = await purchaseWithSnapshot(db, voucher.purchase_id);
  if (!purchase) fail("This voucher could not be found.");

  const { error } = await db
    .from("vouchers")
    .update({
      entitlement: entitlementFor(purchase, snapshot) as never,
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
    if (check.effectiveStatus === "EXPIRED" && voucher?.status === "ACTIVE") {
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
    .eq("status", "ACTIVE");
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

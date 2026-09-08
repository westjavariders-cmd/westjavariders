import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VOUCHER_STATUSES, VOUCHER_TYPES } from "@/lib/voucher";

/**
 * Admin voucher module. Reads run as the signed-in user through RLS
 * (Staff read-only); every mutation is ADMIN-gated and executed server-side.
 */

async function requireAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("is_admin");
  if (isAdmin !== true) throw new Error("Only an ADMIN may perform this operation.");
}

export const listVouchers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        search: z.string().max(120).optional(),
        status: z.enum(VOUCHER_STATUSES).optional(),
        type: z.enum(VOUCHER_TYPES).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = (context as any).supabase
      .from("vouchers")
      .select(
        "id, code, voucher_type, status, issued_at, valid_until, validity_months, redeemed_at, purchase_id, package_id, entitlement, gift_recipient_name, purchases(reference, status, total_idr, paid_idr, outstanding_idr), customers(id, full_name, email, phone)",
      )
      .order("issued_at", { ascending: false })
      .limit(200);

    if (data?.status) query = query.eq("status", data.status);
    if (data?.type) query = query.eq("voucher_type", data.type);

    const { data: rows, error } = await query;
    if (error) throw new Error("These vouchers could not be loaded.");

    const term = (data?.search ?? "").trim().toLowerCase();
    const vouchers = (rows ?? []).filter((v: any) => {
      if (!term) return true;
      return [v.code, v.purchases?.reference, v.customers?.full_name, v.customers?.email, v.gift_recipient_name, v.entitlement?.package_title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    return { vouchers };
  });

export const getVoucherDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ voucherId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = (context as any).supabase;
    const { data: voucher, error } = await db
      .from("vouchers")
      .select(
        "id, code, voucher_type, status, issued_at, valid_until, validity_months, package_id, entitlement, gift_recipient_name, gift_message, redeemed_at, redeemed_by, redemption_note, cancelled_at, representation_version, purchase_id, document_status, document_generated_at, document_error, email_status, email_recipient, email_sent_at, email_error, email_attempts, auto_delivery_at, customers(id, full_name, email, phone, country), purchases(id, reference, status, fulfillment_status, total_idr, paid_idr, outstanding_idr, first_payment_idr, created_at, is_gift)",
      )
      .eq("id", data.voucherId)
      .maybeSingle();
    if (error) throw new Error("This voucher could not be loaded.");
    if (!voucher) throw new Error("This voucher could not be found.");

    const [{ data: snapshot }, { data: payments }] = await Promise.all([
      db.from("purchase_snapshots").select("id, created_at").eq("purchase_id", voucher.purchase_id).maybeSingle(),
      db
        .from("payment_requests")
        .select("id, kind, status, amount_idr, paid_at, created_at")
        .eq("purchase_id", voucher.purchase_id)
        .order("created_at", { ascending: true }),
    ]);

    const { data: contactRows } = await db
      .from("settings")
      .select("key, value")
      .in("key", ["business_name", "contact_email", "contact_whatsapp", "contact_location"]);
    const { readContactSettings } = await import("@/lib/voucher-delivery");
    const contactCheck = readContactSettings(contactRows ?? []);

    return {
      voucher,
      contact_ready: contactCheck.ok,
      contact_missing: contactCheck.ok ? [] : (contactCheck as any).missing,
      snapshot_reference: snapshot?.id ?? null,
      snapshot_taken_at: snapshot?.created_at ?? null,
      payments: payments ?? [],
    };
  });

/** Issues one voucher per purchased package once payment is confirmed. */
export const issueVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ purchaseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { issueVouchersForPurchase } = await import("@/lib/voucher.server");
    const result = await issueVouchersForPurchase(data.purchaseId);
    if (result.vouchers.length === 0) {
      throw new Error(
        result.reason === "payment_not_confirmed"
          ? "The first payment has not been confirmed for this booking yet."
          : result.reason === "purchase_cancelled"
            ? "This booking has been cancelled."
            : "These vouchers could not be issued.",
      );
    }
    return { vouchers: result.vouchers, created: result.created };
  });


export const markVoucherUsedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ voucherId: z.string().uuid(), note: z.string().max(300).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { markVoucherUsed } = await import("@/lib/voucher.server");
    return markVoucherUsed(data.voucherId, (context as any).userId, data.note ?? null);
  });

export const cancelVoucherFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ voucherId: z.string().uuid(), note: z.string().max(300).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { cancelVoucher } = await import("@/lib/voucher.server");
    return cancelVoucher(data.voucherId, data.note ?? null);
  });

/** Rebuilds the document representation; the number never changes. */
export const regenerateVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ voucherId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { regenerateRepresentation } = await import("@/lib/voucher.server");
    return regenerateRepresentation(data.voucherId);
  });

/**
 * Regenerates the voucher PDF from the same historical data. Same voucher
 * number, same package, same purchase; nothing commercial is recalculated.
 */
export const regenerateVoucherDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ voucherId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { generateVoucherDocument } = await import("@/lib/voucher-delivery.server");
    const result = await generateVoucherDocument(data.voucherId);
    if (!result.ok) throw new Error(result.reason);
    return { ok: true };
  });

/** Resends the voucher email with the current valid document attached. */
export const resendVoucherEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ voucherId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { sendVoucherEmail } = await import("@/lib/voucher-delivery.server");
    const result = await sendVoucherEmail(data.voucherId, { automatic: false });
    if (!result.sent) throw new Error(result.reason ?? "This email could not be sent.");
    return { ok: true, recipient: result.recipient };
  });

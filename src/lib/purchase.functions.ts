import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PURCHASE_FULFILLMENT_STATUSES } from "@/lib/customer";

/**
 * Public checkout + Admin purchase management. Every amount is recomputed
 * server-side; the browser only sends identifiers and contact details.
 */

/** Recomputes the cart and shows what would be charged now. */
export const getCheckoutSummary = createServerFn({ method: "POST" }).handler(async () => {
  const { revalidateCart } = await import("@/lib/purchase.server");
  const revalidation = await revalidateCart();
  return {
    packages: revalidation.packages.map((p) => ({
      package_id: p.package_id,
      product_title: p.product_title,
      total_idr: p.total_idr,
      price_changed: p.price_changed,
      previous_total_idr: p.previous_total_idr,
      blockers: p.blockers,
    })),
    total_idr: revalidation.total_idr,
    first_payment_percentage: revalidation.first_payment_percentage,
    first_payment_idr: revalidation.first_payment_idr,
    outstanding_idr: revalidation.outstanding_idr,
    blockers: revalidation.blockers,
    existing_purchase_id: revalidation.existing_purchase_id,
    fx: revalidation.fx,
    customer_total: revalidation.customer_total,
    customer_first_payment: revalidation.customer_first_payment,
    customer_outstanding: revalidation.customer_outstanding,
  };
});

const contactSchema = z.object({
  full_name: z.string(),
  email: z.string(),
  phone: z.string(),
  country: z.string().optional(),
  preferred_language_code: z.string().optional(),
  // Gift intent; validated again server-side.
  is_gift: z.boolean().optional(),
  gift_recipient_name: z.string().max(200).optional(),
  gift_message: z.string().max(400).optional(),
  // Required acceptance of the booking conditions; re-checked server-side.
  risk_accepted: z.boolean().optional(),
});

/**
 * Converts the cart into one Purchase and starts the first payment.
 * The customer record is created or reused server-side; no customer id is
 * ever accepted from the browser.
 */
export const confirmCheckout = createServerFn({ method: "POST" })
  .inputValidator((data) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { createPurchaseFromCart } = await import("@/lib/purchase.server");
    const { purchase, reused } = await createPurchaseFromCart(
      data,
      {
        is_gift: data.is_gift,
        gift_recipient_name: data.gift_recipient_name,
        gift_message: data.gift_message,
      },
      undefined,
      { risk_accepted: data.risk_accepted },
    );
    return {
      purchase,
      reused,
      // Where the customer must be sent to pay; null when no provider is live.
      payment_url: purchase?.payment?.payment_url ?? null,
    };
  });

/** Customer-safe view of one purchase (no internal costs, no contact list). */
export const getPurchaseView = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ purchaseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getPurchase } = await import("@/lib/purchase.server");
    const purchase = await getPurchase(data.purchaseId);
    return { purchase };
  });

/* ------------------------------------------------------------------ */
/* Admin                                                              */
/* ------------------------------------------------------------------ */

export const listPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ search: z.string().max(120).optional(), status: z.string().max(40).optional() })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = (context as any).supabase
      .from("purchases")
      .select(
        "id, reference, status, fulfillment_status, currency_code, total_idr, first_payment_percentage, first_payment_idr, outstanding_idr, paid_idr, created_at, customers(id, full_name, email, phone)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (data?.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error("These purchases could not be loaded.");

    const term = (data?.search ?? "").trim().toLowerCase();
    const purchases = (rows ?? []).filter((p: any) => {
      if (!term) return true;
      const haystack = [
        p.reference,
        p.id,
        p.customers?.full_name,
        p.customers?.email,
        p.customers?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });

    return { purchases };
  });

/** Full purchase detail: customer, immutable snapshot and payment history. */
export const getPurchaseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ purchaseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = (context as any).supabase;
    const { data: purchase, error } = await db
      .from("purchases")
      .select(
        "id, reference, status, fulfillment_status, currency_code, total_idr, first_payment_percentage, first_payment_idr, outstanding_idr, paid_idr, created_at, customer_id, customers(id, full_name, email, phone, country, preferred_language_code)",
      )
      .eq("id", data.purchaseId)
      .maybeSingle();
    if (error) throw new Error("This purchase could not be loaded.");
    if (!purchase) throw new Error("This purchase could not be found.");

    const [{ data: snapshot }, { data: payments }, { data: siblings }, { data: vouchers }] =
      await Promise.all([
        db.from("purchase_snapshots").select("data, created_at").eq("purchase_id", data.purchaseId).maybeSingle(),
        db
          .from("payment_requests")
          .select("id, kind, status, amount_idr, provider, provider_reference, provider_payment_url, paid_at, expires_at, created_at")
          .eq("purchase_id", data.purchaseId)
          .order("created_at", { ascending: true }),
        purchase.customer_id
          ? db
              .from("purchases")
              .select("id, reference, status, total_idr, paid_idr, outstanding_idr, created_at")
              .eq("customer_id", purchase.customer_id)
              .neq("id", data.purchaseId)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] }),
        // One voucher per purchased package: a booking can have several.
        db
          .from("vouchers")
          .select("id, code, voucher_type, status, valid_until, package_id, entitlement")
          .eq("purchase_id", data.purchaseId)
          .order("code", { ascending: true }),
      ]);

    return {
      purchase,
      snapshot: snapshot?.data ?? null,
      snapshot_taken_at: snapshot?.created_at ?? null,
      payments: payments ?? [],
      other_purchases: siblings ?? [],
      vouchers: vouchers ?? [],
    };
  });


export const setPurchaseFulfillment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        purchaseId: z.string().uuid(),
        status: z.enum(PURCHASE_FULFILLMENT_STATUSES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await (context as any).supabase.rpc("is_admin");
    if (isAdmin !== true) throw new Error("Only an ADMIN may perform this operation.");
    const { setFulfillmentStatus } = await import("@/lib/purchase.server");
    return setFulfillmentStatus(data.purchaseId, data.status);
  });

export const requestBalancePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ purchaseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await (context as any).supabase.rpc("is_admin");
    if (isAdmin !== true) throw new Error("Only an ADMIN may perform this operation.");
    const { createBalanceRequest } = await import("@/lib/purchase.server");
    const request = await createBalanceRequest(data.purchaseId);
    return { request };
  });

/* ------------------------------------------------------------------ */
/* Customers (operational contact records)                            */
/* ------------------------------------------------------------------ */

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ search: z.string().max(120).optional() }).optional().parse(data))
  .handler(async ({ context, data }) => {
    const db = (context as any).supabase;
    const { data: customers, error } = await db
      .from("customers")
      .select("id, full_name, email, phone, country, preferred_language_code, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("These customers could not be loaded.");

    const { data: purchases } = await db
      .from("purchases")
      .select("id, customer_id, total_idr, paid_idr, outstanding_idr");

    const term = (data?.search ?? "").trim().toLowerCase();
    const rows = (customers ?? [])
      .filter((c: any) =>
        !term ||
        [c.full_name, c.email, c.phone].filter(Boolean).join(" ").toLowerCase().includes(term),
      )
      .map((c: any) => {
        const own = (purchases ?? []).filter((p: any) => p.customer_id === c.id);
        return {
          ...c,
          purchase_count: own.length,
          total_idr: own.reduce((s: number, p: any) => s + Number(p.total_idr), 0),
          paid_idr: own.reduce((s: number, p: any) => s + Number(p.paid_idr), 0),
          outstanding_idr: own.reduce((s: number, p: any) => s + Number(p.outstanding_idr), 0),
          purchases: own.map((p: any) => p.id),
        };
      });

    return { customers: rows };
  });

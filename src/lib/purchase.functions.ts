import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Public checkout + Admin payment operations. Every amount is recomputed
 * server-side; the browser only sends identifiers.
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
  };
});

/** Converts the cart into one Purchase and starts the first payment. */
export const confirmCheckout = createServerFn({ method: "POST" }).handler(async () => {
  const { createPurchaseFromCart } = await import("@/lib/purchase.server");
  const { purchase, reused } = await createPurchaseFromCart();
  return { purchase, reused };
});

/** Customer-safe view of one purchase (no internal costs). */
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
  .handler(async ({ context }) => {
    const { data, error } = await (context as any).supabase
      .from("purchases")
      .select(
        "id, status, currency_code, total_idr, first_payment_percentage, first_payment_idr, outstanding_idr, paid_idr, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("These purchases could not be loaded.");
    return { purchases: data ?? [] };
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

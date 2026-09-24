import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PublicPage, displayTotal } from "@/components/public/SiteHeader";
import { formatIdr } from "@/lib/public-catalog";
import { getPurchaseView } from "@/lib/purchase.functions";
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@/lib/purchase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/purchase/$purchaseId")({
  head: () => ({
    meta: [
      { title: "Your Booking | West Java Riders" },
      {
        name: "description",
        content:
          "Your West Java Riders booking: what you reserved, the deposit paid and the balance still to settle.",
      },
      { property: "og:title", content: "Your Booking — West Java Riders" },
      {
        property: "og:description",
        content: "Your West Java Riders booking summary and payment status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PurchasePage,
});

function PurchasePage() {
  const { purchaseId } = Route.useParams();
  const load = useServerFn(getPurchaseView);

  const view = useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: () => load({ data: { purchaseId } }),
    refetchOnWindowFocus: false,
  });

  const purchase = view.data?.purchase ?? null;
  const packages: Array<{ product_title: string; total_idr: number }> =
    purchase?.snapshot?.packages ?? [];

  return (
    <PublicPage>
      <h1 className="text-2xl font-semibold tracking-tight">Your booking</h1>

      {view.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}

      {!view.isPending && !purchase && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">This booking could not be found.</p>
          <Link to="/home" className="text-sm underline underline-offset-2">
            See the menu
          </Link>
        </div>
      )}

      {purchase && (
        <div className="mt-6 space-y-6">
          <p className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
            {PURCHASE_STATUS_LABELS[purchase.status as PurchaseStatus] ?? purchase.status}
          </p>

          <div className="space-y-3">
            {packages.map((p, i) => (
              <Card key={`${p.product_title}-${i}`}>
                <CardContent className="flex items-baseline justify-between gap-3 p-4">
                  <p className="text-sm font-medium">{p.product_title.toUpperCase()} — PACKAGE</p>
                  <p className="text-base font-semibold">{formatIdr(p.total_idr)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total price</span>
              <span className="text-base font-semibold">
                {displayTotal(
                  purchase.total_idr,
                  purchase.customer_currency_code
                    ? { currency_code: purchase.customer_currency_code, symbol: "" }
                    : null,
                  purchase.customer_total_amount,
                )}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Due today ({purchase.first_payment_percentage}%)</span>
              <span className="text-xl font-semibold">
                {displayTotal(
                  purchase.first_payment_idr,
                  purchase.customer_currency_code
                    ? { currency_code: purchase.customer_currency_code, symbol: "" }
                    : null,
                  purchase.customer_first_payment_amount,
                )}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Received</span>
              <span className="text-base">{formatIdr(purchase.paid_idr)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Balance, settled with us before your trip
              </span>
              <span className="text-base">
                {displayTotal(
                  purchase.outstanding_idr,
                  purchase.customer_currency_code
                    ? { currency_code: purchase.customer_currency_code, symbol: "" }
                    : null,
                  purchase.customer_outstanding_amount,
                )}
              </span>
            </div>
            {purchase.customer_currency_code && (
              <p className="text-xs text-muted-foreground">
                Fixed at {purchase.fx_rate} Rupiah per {purchase.customer_currency_code} when you
                booked. Payments are taken in Rupiah: {formatIdr(purchase.total_idr)} in total.
              </p>
            )}
          </div>

          {purchase.payment && purchase.payment.status !== "paid" && (
            <div className="space-y-2">
              {purchase.payment.payment_url ? (
                <Button asChild className="w-full">
                  <a href={purchase.payment.payment_url} rel="noreferrer">
                    Pay {formatIdr(purchase.payment.amount_idr)} now
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your booking is saved. We will send you the payment link shortly.
                </p>
              )}
            </div>
          )}

          {purchase.payment?.status === "paid" && (
            <p className="text-sm">
              Your deposit is received. We will contact you about the remaining balance before your
              trip.
            </p>
          )}
        </div>
      )}
    </PublicPage>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PublicPage } from "@/components/public/SiteHeader";
import { formatIdr } from "@/lib/public-catalog";
import { getPurchaseView } from "@/lib/purchase.functions";
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@/lib/purchase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/purchase/$purchaseId")({
  head: () => ({
    meta: [
      { title: "Your Booking | Cimaja Boardriders" },
      {
        name: "description",
        content:
          "Your Cimaja Boardriders booking: what you reserved, the deposit paid and the balance still to settle.",
      },
      { property: "og:title", content: "Your Booking — Cimaja Boardriders" },
      {
        property: "og:description",
        content: "Your Cimaja Boardriders booking summary and payment status.",
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
          <Link to="/build-your-trip" className="text-sm underline underline-offset-2">
            Build your trip
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
              <span className="text-base font-semibold">{formatIdr(purchase.total_idr)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Due today ({purchase.first_payment_percentage}%)</span>
              <span className="text-xl font-semibold">{formatIdr(purchase.first_payment_idr)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Received</span>
              <span className="text-base">{formatIdr(purchase.paid_idr)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Balance, settled with us before your trip
              </span>
              <span className="text-base">{formatIdr(purchase.outstanding_idr)}</span>
            </div>
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

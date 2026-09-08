import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PublicPage, PUBLIC_CART_KEY, usePublicCart } from "@/components/public/SiteHeader";
import { formatIdr } from "@/lib/public-catalog";
import { confirmCheckout, getCheckoutSummary } from "@/lib/purchase.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Cimaja Boardriders" },
      {
        name: "description",
        content:
          "Confirm your Cimaja Boardriders booking, see the amount due today and the balance to settle before you travel.",
      },
      { property: "og:title", content: "Checkout — Cimaja Boardriders" },
      {
        property: "og:description",
        content: "Confirm your booking and pay the deposit for your Cimaja surf trip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = usePublicCart();
  const summaryFn = useServerFn(getCheckoutSummary);
  const confirm = useServerFn(confirmCheckout);
  const [busy, setBusy] = useState(false);

  const summary = useQuery({
    queryKey: ["checkout-summary"],
    queryFn: () => summaryFn({ data: undefined as never }),
    refetchOnWindowFocus: false,
  });

  const data = summary.data;
  const blocked = (data?.blockers.length ?? 0) > 0;
  const changed = (data?.packages ?? []).some((p) => p.price_changed);

  async function book() {
    setBusy(true);
    try {
      const result = await confirm({ data: undefined as never });
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      await cart.refetch();
      const id = result.purchase?.id;
      if (!id) throw new Error("This booking could not be created.");
      navigate({ to: "/purchase/$purchaseId", params: { purchaseId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This booking could not be created.");
      await summary.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicPage>
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      {summary.isPending && <p className="mt-4 text-sm text-muted-foreground">Checking prices…</p>}

      {data && data.existing_purchase_id && (
        <Card className="mt-4">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm">You already confirmed this booking.</p>
            <Button
              onClick={() =>
                navigate({
                  to: "/purchase/$purchaseId",
                  params: { purchaseId: data.existing_purchase_id! },
                })
              }
            >
              View your booking
            </Button>
          </CardContent>
        </Card>
      )}

      {data && !data.existing_purchase_id && (
        <>
          {changed && (
            <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
              Some prices changed since you added them. The amounts below are the ones that apply.
            </p>
          )}

          {blocked && (
            <ul className="mt-4 space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              {data.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          <div className="mt-6 space-y-3">
            {data.packages.map((p) => (
              <Card key={p.package_id}>
                <CardContent className="flex items-baseline justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">{p.product_title.toUpperCase()} — PACKAGE</p>
                    {p.price_changed && (
                      <p className="text-xs text-muted-foreground">
                        Was {formatIdr(p.previous_total_idr)}
                      </p>
                    )}
                  </div>
                  <p className="text-base font-semibold">{formatIdr(p.total_idr)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 space-y-2 border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
                Total price
              </span>
              <span className="text-xl font-semibold">{formatIdr(data.total_idr)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">
                To pay today ({data.first_payment_percentage}%)
              </span>
              <span className="text-2xl font-semibold">{formatIdr(data.first_payment_idr)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Balance, settled with us before your trip
              </span>
              <span className="text-base">{formatIdr(data.outstanding_idr)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Button className="w-full" disabled={blocked || busy} onClick={book}>
              {busy ? "Confirming…" : "Confirm and pay deposit"}
            </Button>
            <Link to="/cart" className="block text-center text-sm underline underline-offset-2">
              Back to cart
            </Link>
          </div>
        </>
      )}
    </PublicPage>
  );
}

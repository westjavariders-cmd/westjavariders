import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  PublicPage,
  PUBLIC_CART_KEY,
  displayTotal,
  usePublicCart,
} from "@/components/public/SiteHeader";
import { formatIdr } from "@/lib/public-catalog";
import { discardDraftPackage, removeCartPackage } from "@/lib/cart.functions";
import { confirmCheckout, getCheckoutSummary } from "@/lib/purchase.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart | Cimaja Boardriders" },
      {
        name: "description",
        content:
          "Review the packages you have built for your Cimaja surf and travel trip before booking.",
      },
      { property: "og:title", content: "Your Cart — Cimaja Boardriders" },
      {
        property: "og:description",
        content: "Review the packages you have built for your Cimaja surf and travel trip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = usePublicCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useServerFn(removeCartPackage);
  const discard = useServerFn(discardDraftPackage);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function run(key: string, fn: () => Promise<unknown>, failure: string) {
    setBusy(key);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      await cart.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failure);
    } finally {
      setBusy(null);
    }
  }

  const packages = cart.data?.packages ?? [];
  const draft = cart.data?.draft ?? null;

  return (
    <PublicPage>
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>

      {cart.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}

      {!cart.isPending && packages.length === 0 && !draft && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Button onClick={() => navigate({ to: "/build-your-trip" })}>Build your trip</Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {packages.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {p.product_title.toUpperCase()} — PACKAGE
                </p>
                <p className="text-base font-semibold">{formatIdr(p.total_idr)}</p>
              </div>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.14em] text-muted-foreground underline"
                onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
              >
                {open[p.id] ? "Hide details" : "View details"}
              </button>
              {open[p.id] && (
                <dl className="space-y-1 border-t border-border pt-3 text-sm">
                  {p.summary.map((line) => (
                    <div key={line.label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{line.label}</dt>
                      <dd className="text-right">{line.value}</dd>
                    </div>
                  ))}
                  {p.promo_code && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Promo code</dt>
                      <dd>{p.promo_code}</dd>
                    </div>
                  )}
                </dl>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy === p.id}
                onClick={() =>
                  run(
                    p.id,
                    () => remove({ data: { packageId: p.id } }),
                    "This package could not be removed.",
                  )
                }
              >
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}

        {draft && (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {draft.product_title.toUpperCase()} — CURRENT PACKAGE
                </p>
                <p className="text-base font-semibold">{formatIdr(draft.total_idr)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Not finished yet, so it is not part of your total.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/build-your-trip/$productId",
                      params: { productId: draft.product_id },
                    })
                  }
                >
                  Continue current package
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === "draft"}
                  onClick={() =>
                    run("draft", () => discard(), "This package could not be discarded.")
                  }
                >
                  Discard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {(packages.length > 0 || draft) && (
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
              Total price
            </span>
            <span className="text-2xl font-semibold">
              {displayTotal(
                cart.data?.payable_total_idr ?? 0,
                cart.data?.fx,
                cart.data?.payable_total_customer,
              )}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Indicative total. It is confirmed when you book.
            {cart.data?.fx && cart.data.fx.currency_code !== "IDR"
              ? ` Charged in Rupiah: ${formatIdr(cart.data.payable_total_idr)}.`
              : ""}
          </p>
          <Button
            className="w-full"
            disabled={packages.length === 0}
            onClick={() => navigate({ to: "/checkout" })}
          >
            Book now
          </Button>
          <Link
            to="/build-your-trip"
            className="block text-center text-sm underline underline-offset-2"
          >
            Continue shopping
          </Link>
        </div>
      )}
    </PublicPage>
  );
}

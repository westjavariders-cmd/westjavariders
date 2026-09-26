import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PublicPage, PUBLIC_CART_KEY, displayTotal } from "@/components/public/SiteHeader";
import { getSavedTrip, loadSavedTrip } from "@/lib/saved-trip.functions";
import { formatIdr } from "@/lib/public-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/trip/$code")({
  head: () => ({
    meta: [
      { title: "A shared trip | West Java Riders" },
      {
        name: "description",
        content: "Open a shared surf and travel trip, with today's prices, and continue booking it.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "A shared trip — West Java Riders" },
      {
        property: "og:description",
        content: "Open a shared surf and travel trip and continue booking it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedTripPage,
});

function SharedTripPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const read = useServerFn(getSavedTrip);
  const load = useServerFn(loadSavedTrip);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["saved-trip", code],
    queryFn: () => read({ data: { code } }),
    refetchOnWindowFocus: false,
  });
  const trip = query.data?.trip ?? null;

  async function loadIntoCart() {
    setBusy(true);
    try {
      const { result } = await load({ data: { code } });
      if (!result || result.loaded === 0) {
        toast.error("This trip could not be added to your cart.");
        return;
      }
      if (result.skipped.length > 0) {
        toast.warning(result.skipped[0]!);
      }
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      navigate({ to: "/cart" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This trip could not be added to your cart.");
    } finally {
      setBusy(false);
    }
  }

  if (query.isPending) {
    return (
      <PublicPage>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PublicPage>
    );
  }

  if (!trip) {
    return (
      <PublicPage>
        <h1 className="text-2xl font-semibold tracking-tight">THIS TRIP IS NO LONGER AVAILABLE</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The link may be wrong or it may have expired. You can start a new trip whenever you like.
        </p>
        <Button className="mt-5" onClick={() => navigate({ to: "/home" })}>
          SEE THE MENU
        </Button>
      </PublicPage>
    );
  }

  return (
    <PublicPage>
      <h1 className="text-2xl font-semibold tracking-tight">A shared trip</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Prices are the current ones. Nothing is reserved until you book.
      </p>

      <div className="mt-6 space-y-3">
        {trip.lines.map((line, index) => (
          <Card key={`${line.title}-${index}`}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{line.title.toUpperCase()}</p>
                <p className="text-base font-semibold">
                  {line.available ? formatIdr(line.total_idr) : "—"}
                </p>
              </div>
              {line.summary.length > 0 && (
                <dl className="space-y-1 border-t border-border pt-3 text-sm">
                  {line.summary.map((row) => (
                    <div key={row.label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="text-right">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {line.blockers.length > 0 && (
                <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  {line.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 space-y-3 border-t border-border pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
            Total price
          </span>
          <span className="text-2xl font-semibold">
            {displayTotal(trip.total_idr, trip.fx, trip.customer_total)}
          </span>
        </div>

        {trip.bookable ? (
          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" disabled={busy} onClick={loadIntoCart}>
              {busy ? "Adding…" : "CONTINUE TO CHECKOUT"}
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={loadIntoCart}>
              EDIT TRIP
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => navigate({ to: "/home" })}>
            SEE THE MENU
          </Button>
        )}
      </div>
    </PublicPage>
  );
}

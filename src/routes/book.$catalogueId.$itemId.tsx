/**
 * Book individually — one catalogue item, one minimal form.
 *
 * The questions mirror exactly how the catalogue prices the item: nights for
 * accommodation, days for motorbikes, people and hours for transport. The
 * price shown is computed live from the catalogue and recomputed again on
 * the server when the booking is added to the cart.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PUBLIC_CART_KEY, PublicPage } from "@/components/public/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIdr } from "@/lib/public-catalog";
import { priceDirectBooking } from "@/lib/direct-booking";
import { bookCatalogueItem, getBookableItem } from "@/lib/direct-booking.functions";

export const Route = createFileRoute("/book/$catalogueId/$itemId")({
  head: () => ({
    meta: [
      { title: "Book individually — West Java Riders" },
      {
        name: "description",
        content: "Book one item directly: accommodation, transport or motorbike in Cimaja.",
      },
      { property: "og:title", content: "Book individually — West Java Riders" },
      {
        property: "og:description",
        content: "Book one item directly: accommodation, transport or motorbike in Cimaja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookItemPage,
});

function BookItemPage() {
  const { catalogueId, itemId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchItem = useServerFn(getBookableItem);
  const book = useServerFn(bookCatalogueItem);

  const itemQuery = useQuery({
    queryKey: ["bookable-item", catalogueId, itemId],
    queryFn: async () => (await fetchItem({ data: { catalogueId, itemId } })).result,
  });

  const [nights, setNights] = useState("1");
  const [days, setDays] = useState("1");
  const [people, setPeople] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const item = itemQuery.data?.item ?? null;
  const catalogue = itemQuery.data?.catalogue ?? null;

  const choices = useMemo(
    () => ({
      nights: Number(nights) || null,
      days: Number(days) || null,
      people: people == null ? null : Number(people),
      hours: hours == null ? null : Number(hours),
    }),
    [nights, days, people, hours],
  );

  const price = useMemo(
    () => (item ? priceDirectBooking(item, choices) : null),
    [item, choices],
  );

  async function submit() {
    if (!item || !price || price.total_idr == null) return;
    setBusy(true);
    try {
      await book({ data: { catalogueId, itemId, choices } });
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      toast.success("Added to your cart.");
      navigate({ to: "/cart" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This booking could not be added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicPage>
      {itemQuery.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!itemQuery.isPending && (!item || !catalogue) && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Not available</h1>
          <p className="text-sm text-muted-foreground">
            This item is not available for booking right now.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to the site</Link>
          </Button>
        </div>
      )}

      {item && catalogue && (
        <div className="max-w-xl space-y-6">
          <header className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {catalogue.name}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}
          </header>

          {item.photo_url && (
            <img
              src={item.photo_url}
              alt={item.name}
              className="aspect-[16/9] w-full rounded-lg border border-border/60 object-cover"
            />
          )}

          <Card>
            <CardContent className="space-y-4 p-4">
              {item.catalogue_type === "accommodation_room" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nights">Nights</Label>
                  <Input
                    id="nights"
                    type="number"
                    min={1}
                    max={365}
                    value={nights}
                    onChange={(e) => setNights(e.target.value)}
                  />
                </div>
              )}

              {item.catalogue_type === "motorbike" && (
                <div className="space-y-1.5">
                  <Label htmlFor="days">Days</Label>
                  <Input
                    id="days"
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  />
                </div>
              )}

              {item.catalogue_type === "transport" && item.variants && (
                <>
                  {item.variants.people.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>{item.variants.people_label}</Label>
                      <Select value={people ?? ""} onValueChange={setPeople}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {item.variants.people.map((p) => (
                            <SelectItem key={p.value} value={String(p.value)}>
                              {p.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {item.variants.hours.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>{item.variants.hours_label}</Label>
                      <Select value={hours ?? ""} onValueChange={setHours}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {item.variants.hours.map((h) => (
                            <SelectItem key={h.value} value={String(h.value)}>
                              {h.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">
                  {price?.total_idr != null ? formatIdr(price.total_idr) : "—"}
                </p>
              </div>

              {price && price.issues.length > 0 && (
                <p className="text-sm text-muted-foreground">{price.issues[0]}</p>
              )}

              <Button
                className="w-full"
                disabled={busy || !price || price.total_idr == null}
                onClick={submit}
              >
                {busy ? "Adding…" : "Add to cart"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PublicPage>
  );
}

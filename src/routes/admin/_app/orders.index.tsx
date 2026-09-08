import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { listPurchases } from "@/lib/purchase.functions";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUSES, type PurchaseStatus } from "@/lib/purchase";
import { PURCHASE_FULFILLMENT_LABELS, type PurchaseFulfillmentStatus } from "@/lib/customer";
import { formatIdr } from "@/lib/public-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/_app/orders/")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const load = useServerFn(listPurchases);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");

  const list = useQuery({
    queryKey: ["admin-purchases", search, status],
    queryFn: () => load({ data: { search, status: status || undefined } }),
  });

  const purchases = list.data?.purchases ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages / Orders"
        description="Every confirmed purchase, who bought it, what has been received and what is still outstanding."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search reference, name, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          size="sm"
          variant={status === "" ? "default" : "outline"}
          onClick={() => setStatus("")}
        >
          All
        </Button>
        {PURCHASE_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {PURCHASE_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!list.isPending && purchases.length === 0 && (
        <p className="text-sm text-muted-foreground">No purchases match this search.</p>
      )}

      <div className="space-y-3">
        {purchases.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <Link
                    to="/admin/orders/$purchaseId"
                    params={{ purchaseId: p.id }}
                    className="font-medium underline underline-offset-2"
                  >
                    {p.reference ?? p.id}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {p.customers?.full_name ?? "No contact"}
                    {p.customers?.email ? ` · ${p.customers.email}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                    {PURCHASE_STATUS_LABELS[p.status as PurchaseStatus] ?? p.status}
                  </Badge>
                  <Badge variant="outline">
                    {PURCHASE_FULFILLMENT_LABELS[
                      p.fulfillment_status as PurchaseFulfillmentStatus
                    ] ?? p.fulfillment_status}
                  </Badge>
                </div>
              </div>
              <dl className="grid gap-1 text-sm sm:grid-cols-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd>{formatIdr(Number(p.total_idr))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Received</dt>
                  <dd>{formatIdr(Number(p.paid_idr))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Outstanding</dt>
                  <dd>{formatIdr(Number(p.outstanding_idr))}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

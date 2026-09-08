import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { listPurchases, requestBalancePayment } from "@/lib/purchase.functions";
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@/lib/purchase";
import { formatIdr } from "@/lib/public-catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/orders")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const load = useServerFn(listPurchases);
  const requestBalance = useServerFn(requestBalancePayment);
  const [busy, setBusy] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-purchases"],
    queryFn: () => load({ data: undefined as never }),
  });

  const purchases = list.data?.purchases ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages / Orders"
        description="Every confirmed purchase, what has been received and what is still outstanding."
      />

      {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!list.isPending && purchases.length === 0 && (
        <p className="text-sm text-muted-foreground">No purchases yet.</p>
      )}

      <div className="space-y-3">
        {purchases.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={p.status === "paid" ? "default" : "secondary"}>
                  {PURCHASE_STATUS_LABELS[p.status as PurchaseStatus] ?? p.status}
                </Badge>
              </div>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd>{formatIdr(Number(p.total_idr))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    First payment ({Number(p.first_payment_percentage)}%)
                  </dt>
                  <dd>{formatIdr(Number(p.first_payment_idr))}</dd>
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
              {canEdit && Number(p.outstanding_idr) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    try {
                      await requestBalance({ data: { purchaseId: p.id } });
                      toast.success("Balance payment recorded as due.");
                      await list.refetch();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "This action could not be completed.",
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Collect balance
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

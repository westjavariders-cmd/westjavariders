import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  getPurchaseDetail,
  requestBalancePayment,
  setPurchaseFulfillment,
} from "@/lib/purchase.functions";
import {
  PAYMENT_STATUS_LABELS,
  PURCHASE_STATUS_LABELS,
  type PaymentRequestStatus,
  type PurchaseStatus,
} from "@/lib/purchase";
import {
  PURCHASE_FULFILLMENT_LABELS,
  PURCHASE_FULFILLMENT_STATUSES,
  type PurchaseFulfillmentStatus,
} from "@/lib/customer";
import { formatIdr } from "@/lib/public-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/orders/$purchaseId")({
  component: PurchaseDetailPage,
});

const KIND_LABELS: Record<string, string> = {
  first_payment: "Deposit",
  balance: "Balance",
};

function PurchaseDetailPage() {
  const { purchaseId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const load = useServerFn(getPurchaseDetail);
  const requestBalance = useServerFn(requestBalancePayment);
  const setFulfillment = useServerFn(setPurchaseFulfillment);
  const [busy, setBusy] = useState(false);

  const detail = useQuery({
    queryKey: ["admin-purchase", purchaseId],
    queryFn: () => load({ data: { purchaseId } }),
  });

  const data = detail.data;
  const purchase: any = data?.purchase;
  const customer: any = purchase?.customers;
  const snapshot: any = data?.snapshot;
  const packages: any[] = snapshot?.packages ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={purchase?.reference ?? "Purchase"}
        description="Who bought it, exactly what they bought, what was agreed and what remains outstanding."
      />

      <Link to="/admin/orders" className="text-sm underline underline-offset-2">
        Back to all purchases
      </Link>

      {detail.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {detail.isError && (
        <p className="text-sm text-destructive">This purchase could not be loaded.</p>
      )}

      {purchase && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {customer ? (
                <>
                  <p className="font-medium">{customer.full_name}</p>
                  <p className="text-muted-foreground">{customer.email}</p>
                  <p className="text-muted-foreground">{customer.phone}</p>
                  {customer.country && <p className="text-muted-foreground">{customer.country}</p>}
                  {(data?.other_purchases?.length ?? 0) > 0 && (
                    <div className="pt-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Other purchases by this customer
                      </p>
                      <ul className="mt-1 space-y-1">
                        {data!.other_purchases.map((o: any) => (
                          <li key={o.id}>
                            <Link
                              to="/admin/orders/$purchaseId"
                              params={{ purchaseId: o.id }}
                              className="underline underline-offset-2"
                            >
                              {o.reference ?? o.id}
                            </Link>{" "}
                            <span className="text-muted-foreground">
                              {formatIdr(Number(o.total_idr))} ·{" "}
                              {new Date(o.created_at).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No contact recorded for this purchase.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Purchase</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant={purchase.status === "paid" ? "default" : "secondary"}>
                  {PURCHASE_STATUS_LABELS[purchase.status as PurchaseStatus] ?? purchase.status}
                </Badge>
                <Badge variant="outline">
                  {PURCHASE_FULFILLMENT_LABELS[
                    purchase.fulfillment_status as PurchaseFulfillmentStatus
                  ] ?? purchase.fulfillment_status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid gap-1 sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono text-xs">{purchase.reference ?? purchase.id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{new Date(purchase.created_at).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Total</dt>
                  <dd>{formatIdr(Number(purchase.total_idr))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    First payment ({Number(purchase.first_payment_percentage)}%)
                  </dt>
                  <dd>{formatIdr(Number(purchase.first_payment_idr))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Received</dt>
                  <dd>{formatIdr(Number(purchase.paid_idr))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Outstanding</dt>
                  <dd>{formatIdr(Number(purchase.outstanding_idr))}</dd>
                </div>
              </dl>

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Operational status
                  </span>
                  {PURCHASE_FULFILLMENT_STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={purchase.fulfillment_status === s ? "default" : "outline"}
                      disabled={busy || purchase.fulfillment_status === s}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await setFulfillment({ data: { purchaseId, status: s } });
                          await recordAdminAction(
                            "purchase.fulfillment_status",
                            "purchase",
                            purchase.reference ?? purchaseId,
                            { status: s },
                          );
                          toast.success("Operational status updated.");
                          await detail.refetch();
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "This action could not be completed.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {PURCHASE_FULFILLMENT_LABELS[s]}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Purchased packages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {packages.length === 0 && (
                <p className="text-muted-foreground">
                  No historical package record found for this purchase.
                </p>
              )}
              {packages.map((pkg: any) => (
                <div key={pkg.package_id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{pkg.product_title}</p>
                    <p className="font-semibold">{formatIdr(Number(pkg.total_idr))}</p>
                  </div>
                  <dl className="mt-2 space-y-1">
                    {Object.entries(pkg.answers ?? {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd>{formatAnswer(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className="mt-2 space-y-1 border-t border-border pt-2">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd>{formatIdr(Number(pkg.subtotal_idr))}</dd>
                    </div>
                    {Number(pkg.season_discount_idr) > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">
                          Season discount ({pkg.season_period ?? "—"})
                        </dt>
                        <dd>−{formatIdr(Number(pkg.season_discount_idr))}</dd>
                      </div>
                    )}
                    {Number(pkg.promo_discount_idr) > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">
                          Promotion {pkg.promo_code ? `(${pkg.promo_code})` : ""}
                        </dt>
                        <dd>−{formatIdr(Number(pkg.promo_discount_idr))}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
              {data?.snapshot_taken_at && (
                <p className="text-xs text-muted-foreground">
                  Historical record taken {new Date(data.snapshot_taken_at).toLocaleString()}. It
                  never changes when current prices or products change.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vouchers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(data?.vouchers?.length ?? 0) === 0 && (
                <p className="text-muted-foreground">
                  No vouchers yet. One voucher per package is issued once the payment is confirmed.
                </p>
              )}
              {(data?.vouchers ?? []).map((v: any) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div>
                    <Link
                      to="/admin/vouchers/$voucherId"
                      params={{ voucherId: v.id }}
                      className="font-mono font-medium underline underline-offset-2"
                    >
                      {v.code}
                    </Link>
                    <p className="text-muted-foreground">
                      {v.entitlement?.package_title ?? "Purchased package"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{v.voucher_type === "GIFT" ? "Gift" : "Standard"}</Badge>
                    <Badge variant={v.status === "ACTIVE" ? "default" : "secondary"}>{v.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>



          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Payment history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(data?.payments?.length ?? 0) === 0 && (
                <p className="text-muted-foreground">No payments recorded yet.</p>
              )}
              {(data?.payments ?? []).map((pay: any) => (
                <div
                  key={pay.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{KIND_LABELS[pay.kind] ?? pay.kind}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(pay.created_at).toLocaleString()}
                      {pay.paid_at ? ` · received ${new Date(pay.paid_at).toLocaleString()}` : ""}
                      {pay.provider ? ` · ${pay.provider}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={pay.status === "paid" ? "default" : "secondary"}>
                      {PAYMENT_STATUS_LABELS[pay.status as PaymentRequestStatus] ?? pay.status}
                    </Badge>
                    <span>{formatIdr(Number(pay.amount_idr))}</span>
                  </div>
                </div>
              ))}

              <div className="space-y-1 border-t border-border pt-3">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total purchase</span>
                  <span>{formatIdr(Number(purchase.total_idr))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Payments received</span>
                  <span>−{formatIdr(Number(purchase.paid_idr))}</span>
                </div>
                <div className="flex justify-between gap-4 font-semibold">
                  <span>Outstanding balance</span>
                  <span>{formatIdr(Number(purchase.outstanding_idr))}</span>
                </div>
              </div>

              {canEdit && Number(purchase.outstanding_idr) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await requestBalance({ data: { purchaseId } });
                      await recordAdminAction(
                        "purchase.collect_balance",
                        "purchase",
                        purchase.reference ?? purchaseId,
                        {},
                      );
                      toast.success("Balance payment recorded as due.");
                      await detail.refetch();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "This action could not be completed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Collect balance
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null || value === "") return "—";
  return String(value);
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  cancelVoucherFn,
  getVoucherDetail,
  markVoucherUsedFn,
  regenerateVoucher,
  regenerateVoucherDocument,
  resendVoucherEmail,
} from "@/lib/voucher.functions";
import {
  DOCUMENT_STATUS_LABELS,
  EMAIL_STATUS_LABELS,
  type DocumentStatus,
  type EmailStatus,
} from "@/lib/voucher-delivery";
import {
  VOUCHER_STATUS_LABELS,
  VOUCHER_TYPE_LABELS,
  effectiveStatus,
  type VoucherStatus,
  type VoucherType,
} from "@/lib/voucher";
import { PAYMENT_STATUS_LABELS, type PaymentRequestStatus } from "@/lib/purchase";
import { formatIdr } from "@/lib/public-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/_app/vouchers/$voucherId")({
  component: VoucherDetailPage,
});

const KIND_LABELS: Record<string, string> = {
  first_payment: "Deposit",
  balance: "Balance",
};

function VoucherDetailPage() {
  const { voucherId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;

  const load = useServerFn(getVoucherDetail);
  const markUsed = useServerFn(markVoucherUsedFn);
  const cancel = useServerFn(cancelVoucherFn);
  const regenerate = useServerFn(regenerateVoucher);
  const regenerateDocument = useServerFn(regenerateVoucherDocument);
  const resendEmail = useServerFn(resendVoucherEmail);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const detail = useQuery({
    queryKey: ["admin-voucher", voucherId],
    queryFn: () => load({ data: { voucherId } }),
  });

  const voucher: any = detail.data?.voucher;
  const entitlement: any = voucher?.entitlement ?? {};

  async function run(action: () => Promise<unknown>, audit: string, success: string) {
    setBusy(true);
    try {
      await action();
      await recordAdminAction(audit, "voucher", voucherId, { code: voucher?.code });
      await detail.refetch();
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (detail.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!voucher) return <p className="text-sm text-muted-foreground">This voucher was not found.</p>;

  const shown = effectiveStatus(voucher.status as VoucherStatus, voucher.valid_until);

  return (
    <div className="space-y-6">
      <PageHeader
        title={voucher.code}
        description="A voucher for one purchased package. The number and validity never change."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {VOUCHER_TYPE_LABELS[voucher.voucher_type as VoucherType] ?? voucher.voucher_type}
        </Badge>
        <Badge variant={shown === "ACTIVE" ? "default" : "secondary"}>
          {VOUCHER_STATUS_LABELS[shown] ?? shown}
        </Badge>
        {voucher.purchases && (
          <Link
            to="/admin/orders/$purchaseId"
            params={{ purchaseId: voucher.purchases.id }}
            className="text-sm underline underline-offset-2"
          >
            {voucher.purchases.reference ?? "Booking"}
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchased package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{entitlement.package_title ?? "Purchased package"}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {voucher.package_id ?? entitlement.package_id ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Each purchased package of a booking has exactly one voucher.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Validity and issue</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{new Date(voucher.issued_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Valid until</dt>
              <dd>{new Date(voucher.valid_until).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Validity applied</dt>
              <dd>{voucher.validity_months} months</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dates</dt>
              <dd>Open — booked with us later</dd>
            </div>
            {voucher.redeemed_at && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Used on</dt>
                <dd>{new Date(voucher.redeemed_at).toLocaleString()}</dd>
              </div>
            )}
            {voucher.cancelled_at && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cancelled on</dt>
                <dd>{new Date(voucher.cancelled_at).toLocaleString()}</dd>
              </div>
            )}
            {voucher.redemption_note && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Note</dt>
                <dd>{voucher.redemption_note}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What the customer receives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <p className="font-medium">{entitlement.customer_name ?? "—"}</p>
            {voucher.voucher_type === "GIFT" && (
              <>
                <p className="text-muted-foreground">
                  Gift for {voucher.gift_recipient_name ?? "the recipient"}
                </p>
                {voucher.gift_message && (
                  <p className="rounded-md border border-border bg-muted/40 p-3 italic">
                    {voucher.gift_message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  A gift voucher never shows any price.
                </p>
              </>
            )}
            {voucher.voucher_type !== "GIFT" && entitlement.total_idr != null && (
              <p>{formatIdr(Number(entitlement.total_idr))} total</p>
            )}
          </div>

          <ul className="space-y-3">
            {(entitlement.items ?? []).map((item: any, i: number) => (
              <li key={i} className="rounded-md border border-border p-3">
                <p className="font-medium">{item.product_title}</p>
                {(item.options ?? []).length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {item.options.map((o: any, j: number) => (
                      <li key={j}>
                        <p className="text-xs text-muted-foreground">{o.label}</p>
                        <p className="text-sm font-medium">{o.value}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {(entitlement.usage_instructions ?? []).map((line: string, i: number) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Document version {voucher.representation_version}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments on this booking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(detail.data?.payments ?? []).length === 0 && (
            <p className="text-muted-foreground">No payments recorded.</p>
          )}
          {(detail.data?.payments ?? []).map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                {KIND_LABELS[p.kind] ?? p.kind} · {formatIdr(Number(p.amount_idr))}
              </span>
              <span className="text-muted-foreground">
                {PAYMENT_STATUS_LABELS[p.status as PaymentRequestStatus] ?? p.status}
                {p.paid_at ? ` · ${new Date(p.paid_at).toLocaleDateString()}` : ""}
              </span>
            </div>
          ))}
          {detail.data?.snapshot_taken_at && (
            <p className="pt-2 text-xs text-muted-foreground">
              Based on the booking record kept on{" "}
              {new Date(detail.data.snapshot_taken_at).toLocaleString()}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {detail.data?.contact_ready === false && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
              Customer-facing contact details are missing. Add a contact email and a contact
              WhatsApp number in Settings before this voucher can be sent.
            </p>
          )}

          <div className="space-y-1">
            <p className="font-medium">Document</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={voucher.document_status === "GENERATED" ? "default" : "secondary"}>
                {DOCUMENT_STATUS_LABELS[voucher.document_status as DocumentStatus] ??
                  voucher.document_status}
              </Badge>
              <span className="text-muted-foreground">
                {voucher.document_generated_at
                  ? new Date(voucher.document_generated_at).toLocaleString()
                  : "Not generated yet"}
              </span>
            </div>
            {voucher.document_error && (
              <p className="text-xs text-destructive">{voucher.document_error}</p>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () => regenerateDocument({ data: { voucherId } }),
                    "voucher.document.regenerated",
                    "The voucher PDF was generated again.",
                  )
                }
              >
                Regenerate document
              </Button>
            )}
          </div>

          <div className="space-y-1 border-t border-border pt-4">
            <p className="font-medium">Email</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={voucher.email_status === "SENT" ? "default" : "secondary"}>
                {EMAIL_STATUS_LABELS[voucher.email_status as EmailStatus] ?? voucher.email_status}
              </Badge>
              <span className="text-muted-foreground">
                {voucher.email_recipient ?? "No recipient recorded"}
              </span>
              <span className="text-muted-foreground">
                {voucher.email_sent_at ? new Date(voucher.email_sent_at).toLocaleString() : ""}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {voucher.voucher_type === "GIFT"
                ? "A gift voucher email goes to the buyer, who forwards it."
                : "A standard voucher email goes to the voucher holder."}{" "}
              Attempts: {voucher.email_attempts ?? 0}
            </p>
            {voucher.email_error && <p className="text-xs text-destructive">{voucher.email_error}</p>}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () => resendEmail({ data: { voucherId } }),
                    "voucher.email.resent",
                    "The voucher email was sent again.",
                  )
                }
              >
                Resend email
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || shown !== "ACTIVE"}
                onClick={() =>
                  run(
                    () => markUsed({ data: { voucherId, note: note || undefined } }),
                    "voucher.used",
                    "This voucher is now marked as used.",
                  )
                }
              >
                Mark as used
              </Button>
              <Button
                variant="outline"
                disabled={busy || voucher.status === "USED" || voucher.status === "CANCELLED"}
                onClick={() =>
                  run(
                    () => cancel({ data: { voucherId, note: note || undefined } }),
                    "voucher.cancelled",
                    "This voucher has been cancelled.",
                  )
                }
              >
                Cancel voucher
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () => regenerate({ data: { voucherId } }),
                    "voucher.regenerated",
                    "The voucher document was rebuilt.",
                  )
                }
              >
                Rebuild document
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cancelling affects the voucher only. The booking and its payments stay untouched.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

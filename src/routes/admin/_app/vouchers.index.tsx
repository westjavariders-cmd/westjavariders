import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { listVouchers } from "@/lib/voucher.functions";
import {
  VOUCHER_STATUSES,
  VOUCHER_STATUS_LABELS,
  VOUCHER_TYPES,
  VOUCHER_TYPE_LABELS,
  effectiveStatus,
  type VoucherStatus,
  type VoucherType,
} from "@/lib/voucher";
import { formatIdr } from "@/lib/public-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/_app/vouchers/")({
  component: VouchersPage,
});

function VouchersPage() {
  const load = useServerFn(listVouchers);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VoucherStatus | "">("");
  const [type, setType] = useState<VoucherType | "">("");

  const list = useQuery({
    queryKey: ["admin-vouchers", search, status, type],
    queryFn: () =>
      load({
        data: { search, status: status || undefined, type: type || undefined },
      }),
  });

  const vouchers = list.data?.vouchers ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vouchers"
        description="One voucher per purchased package. A booking with several packages has several vouchers, all linked to that booking."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search voucher number, package, booking, name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button size="sm" variant={status === "" ? "default" : "outline"} onClick={() => setStatus("")}>
          All statuses
        </Button>
        {VOUCHER_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {VOUCHER_STATUS_LABELS[s]}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant={type === "" ? "default" : "outline"} onClick={() => setType("")}>
          All types
        </Button>
        {VOUCHER_TYPES.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={type === t ? "default" : "outline"}
            onClick={() => setType(t)}
          >
            {VOUCHER_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>

      {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!list.isPending && vouchers.length === 0 && (
        <p className="text-sm text-muted-foreground">No vouchers match this search.</p>
      )}

      <div className="space-y-3">
        {vouchers.map((v: any) => {
          const shown = effectiveStatus(v.status as VoucherStatus, v.valid_until);
          return (
            <Card key={v.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Link
                      to="/admin/vouchers/$voucherId"
                      params={{ voucherId: v.id }}
                      className="font-mono font-medium underline underline-offset-2"
                    >
                      {v.code}
                    </Link>
                    <p className="text-sm font-medium">
                      {v.entitlement?.package_title ?? "Purchased package"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {v.customers?.full_name ?? "No contact"}
                      {v.customers?.email ? ` · ${v.customers.email}` : ""}
                    </p>
                    {v.voucher_type === "GIFT" && v.gift_recipient_name && (
                      <p className="text-xs text-muted-foreground">
                        Gift for {v.gift_recipient_name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {VOUCHER_TYPE_LABELS[v.voucher_type as VoucherType] ?? v.voucher_type}
                    </Badge>
                    <Badge variant={shown === "ACTIVE" ? "default" : "secondary"}>
                      {VOUCHER_STATUS_LABELS[shown] ?? shown}
                    </Badge>
                  </div>
                </div>
                <dl className="grid gap-1 text-sm sm:grid-cols-3">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd>{new Date(v.issued_at).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Valid until</dt>
                    <dd>{new Date(v.valid_until).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Booking</dt>
                    <dd>{v.purchases?.reference ?? "—"}</dd>
                  </div>
                </dl>
                {v.voucher_type !== "GIFT" && v.purchases && (
                  <p className="text-xs text-muted-foreground">
                    {formatIdr(Number(v.purchases.total_idr))} total ·{" "}
                    {formatIdr(Number(v.purchases.outstanding_idr))} outstanding
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

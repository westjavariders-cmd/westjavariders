import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { listCustomers } from "@/lib/purchase.functions";
import { formatIdr } from "@/lib/public-catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/_app/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const load = useServerFn(listCustomers);
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["admin-customers", search],
    queryFn: () => load({ data: { search } }),
  });

  const customers = list.data?.customers ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Operational contact records: who booked, how to reach them and their purchase history."
      />

      <Input
        className="max-w-xs"
        placeholder="Search name, email or phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!list.isPending && customers.length === 0 && (
        <p className="text-sm text-muted-foreground">No customers yet.</p>
      )}

      <div className="space-y-3">
        {customers.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-medium">{c.full_name}</p>
                  <p className="text-muted-foreground">{c.email}</p>
                  <p className="text-muted-foreground">{c.phone}</p>
                  {c.country && <p className="text-muted-foreground">{c.country}</p>}
                </div>
                <div className="text-right">
                  <p>
                    {c.purchase_count} purchase{c.purchase_count === 1 ? "" : "s"}
                  </p>
                  <p className="text-muted-foreground">
                    {formatIdr(Number(c.total_idr))} total · {formatIdr(Number(c.paid_idr))}{" "}
                    received · {formatIdr(Number(c.outstanding_idr))} outstanding
                  </p>
                </div>
              </div>
              {c.purchases.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                  {c.purchases.map((id: string) => (
                    <Link
                      key={id}
                      to="/admin/orders/$purchaseId"
                      params={{ purchaseId: id }}
                      className="text-xs underline underline-offset-2"
                    >
                      Open purchase
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

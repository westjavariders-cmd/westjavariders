import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { createProduct, duplicateProduct } from "@/lib/catalog.functions";
import { PRODUCT_KINDS, PRODUCT_STATUSES } from "@/lib/catalog";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/_app/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();
  const create = useServerFn(createProduct);
  const duplicate = useServerFn(duplicateProduct);

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ internal_name: "", kind: "package", internal_ref: "" });
  const [busy, setBusy] = useState(false);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, internal_name, internal_ref, kind, status, updated_at, product_categories(category_id), product_placements(placement_id)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  const rows = (products.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !`${p.internal_name} ${p.internal_ref ?? ""}`.toLowerCase().includes(q)) return false;
    if (kind && p.kind !== kind) return false;
    if (status && p.status !== status) return false;
    if (categoryId && !p.product_categories.some((c) => c.category_id === categoryId)) return false;
    return true;
  });

  async function submit() {
    setBusy(true);
    try {
      const res = await create({
        data: {
          internal_name: draft.internal_name,
          kind: draft.kind as "package" | "insurance",
          internal_ref: draft.internal_ref || undefined,
        },
      });
      setOpen(false);
      setDraft({ internal_name: "", kind: "package", internal_ref: "" });
      navigate({ to: "/admin/products/$productId", params: { productId: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This product could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function onDuplicate(id: string) {
    try {
      const res = await duplicate({ data: { productId: id } });
      toast.success("Product duplicated.");
      navigate({ to: "/admin/products/$productId", params: { productId: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This product could not be duplicated.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Every commercial product, its content and its configurator."
        actions={
          canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New product</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Internal name</Label>
                    <Input
                      value={draft.internal_name}
                      onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kind</Label>
                    <select
                      className={selectClass}
                      value={draft.kind}
                      onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                    >
                      {PRODUCT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Internal reference (optional)</Label>
                    <Input
                      value={draft.internal_ref}
                      onChange={(e) => setDraft({ ...draft, internal_ref: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submit} disabled={busy || !draft.internal_name.trim()}>
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input
          placeholder="Search name or reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All kinds</option>
          {PRODUCT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {products.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!products.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No product matches these filters.</p>
      )}

      <div className="space-y-2">
        {rows.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  to="/admin/products/$productId"
                  params={{ productId: p.id }}
                  className="text-sm font-medium hover:underline"
                >
                  {p.internal_name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.kind}
                  {p.internal_ref ? ` · ${p.internal_ref}` : ""} ·{" "}
                  {p.product_categories
                    .map((c) => categoryName.get(c.category_id) ?? "?")
                    .join(", ") || "no category"}{" "}
                  · {p.product_placements.length} placement(s) · updated{" "}
                  {new Date(p.updated_at).toISOString().slice(0, 16).replace("T", " ")} UTC
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => onDuplicate(p.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  createPromoCode,
  deletePromoCode,
  setPromoCodeActive,
  updatePromoCode,
} from "@/lib/commercial.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { selectClass } from "@/components/admin/configurator/ui";

export const Route = createFileRoute("/admin/_app/promo-codes")({
  component: PromoCodesPage,
});

type Draft = {
  id: string | null;
  code: string;
  internal_name: string;
  discount_percentage: string;
  active: boolean;
  starts_at: string;
  expires_at: string;
  gift_eligible: boolean;
  notes: string;
  productIds: string[];
  categoryIds: string[];
};

const emptyDraft: Draft = {
  id: null,
  code: "",
  internal_name: "",
  discount_percentage: "10",
  active: false,
  starts_at: "",
  expires_at: "",
  gift_eligible: false,
  notes: "",
  productIds: [],
  categoryIds: [],
};

function PromoCodesPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;

  const create = useServerFn(createPromoCode);
  const update = useServerFn(updatePromoCode);
  const setActive = useServerFn(setPromoCodeActive);
  const remove = useServerFn(deletePromoCode);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const promosQuery = useQuery({
    queryKey: ["promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*, promo_code_products(product_id), promo_code_categories(category_id)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const productsQuery = useQuery({
    queryKey: ["promo-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, internal_name, kind")
        .neq("kind", "insurance")
        .order("internal_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["promo-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("display_order");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const visible = (promosQuery.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    const matches =
      q === "" || p.code.toLowerCase().includes(q) || p.internal_name.toLowerCase().includes(q);
    const state = filter === "all" || (filter === "active" ? p.active : !p.active);
    return matches && state;
  });

  async function submit() {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        internal_name: draft.internal_name.trim(),
        discount_percentage: Number(draft.discount_percentage || 0),
        active: draft.active,
        starts_at: draft.starts_at === "" ? null : new Date(draft.starts_at).toISOString(),
        expires_at: draft.expires_at === "" ? null : new Date(draft.expires_at).toISOString(),
        gift_eligible: draft.gift_eligible,
        notes: draft.notes.trim() === "" ? null : draft.notes.trim(),
        productIds: draft.productIds,
        categoryIds: draft.categoryIds,
      };
      if (draft.id) await update({ data: { ...payload, id: draft.id } });
      else await create({ data: payload });
      toast.success("Promo code saved.");
      setDraft(null);
      void promosQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This promo code could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await setActive({ data: { id, active } });
      void promosQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The promo code could not be updated.");
    }
  }

  async function destroy(id: string) {
    try {
      await remove({ data: { id } });
      toast.success("Promo code deleted.");
      void promosQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The promo code could not be deleted.");
    }
  }

  const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

  return (
    <div>
      <PageHeader
        breadcrumb={["Promo Codes"]}
        title="Promo Codes"
        description="Percentage promotions. Insurance never receives a promotion."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setDraft({ ...emptyDraft })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New promo code
            </Button>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: promo codes are read-only.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Search</Label>
          <Input
            className="h-8 w-56 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="code or name"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <select
            className={selectClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {draft && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">{draft.id ? "Edit promo code" : "New promo code"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Code</Label>
                <Input
                  className="h-8 text-xs uppercase"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Internal name</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.internal_name}
                  onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Discount (%)</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.discount_percentage}
                  onChange={(e) => setDraft({ ...draft, discount_percentage: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <Label className="text-xs">Active</Label>
                  <div className="mt-1">
                    <Switch
                      checked={draft.active}
                      onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Usable on a gift</Label>
                  <div className="mt-1">
                    <Switch
                      checked={draft.gift_eligible}
                      onCheckedChange={(v) => setDraft({ ...draft, gift_eligible: v })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">Starts</Label>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={draft.starts_at}
                  onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Ends</Label>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={draft.expires_at}
                  onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Internal notes</Label>
              <Input
                className="h-8 text-xs"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Leave both lists empty to allow every product except insurance.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium">Products</p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {(productsQuery.data ?? []).map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.productIds.includes(p.id)}
                        onCheckedChange={(v) =>
                          setDraft({
                            ...draft,
                            productIds:
                              v === true
                                ? [...draft.productIds, p.id]
                                : draft.productIds.filter((x) => x !== p.id),
                          })
                        }
                      />
                      {p.internal_name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Categories</p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {(categoriesQuery.data ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.categoryIds.includes(c.id)}
                        onCheckedChange={(v) =>
                          setDraft({
                            ...draft,
                            categoryIds:
                              v === true
                                ? [...draft.categoryIds, c.id]
                                : draft.categoryIds.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={submit}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {promosQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {visible.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm"
          >
            <span className="font-mono font-medium">{p.code}</span>
            <span className="text-muted-foreground">{p.internal_name}</span>
            <Badge variant="secondary">−{p.discount_percentage}%</Badge>
            <Badge variant={p.active ? "default" : "outline"}>{p.active ? "active" : "inactive"}</Badge>
            {p.gift_eligible && <Badge variant="outline">gifts</Badge>}
            <span className="text-xs text-muted-foreground">
              {p.starts_at ? new Date(p.starts_at).toLocaleDateString() : "—"} →{" "}
              {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {p.promo_code_products.length + p.promo_code_categories.length === 0
                ? "all products"
                : `${p.promo_code_products.length} product(s), ${p.promo_code_categories.length} category(ies)`}
            </span>
            {canEdit && (
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(p.id, !p.active)}>
                  {p.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      id: p.id,
                      code: p.code,
                      internal_name: p.internal_name,
                      discount_percentage: String(p.discount_percentage),
                      active: p.active,
                      starts_at: toLocalInput(p.starts_at),
                      expires_at: toLocalInput(p.expires_at),
                      gift_eligible: p.gift_eligible,
                      notes: p.notes ?? "",
                      productIds: p.promo_code_products.map((x) => x.product_id),
                      categoryIds: p.promo_code_categories.map((x) => x.category_id),
                    })
                  }
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => destroy(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {!promosQuery.isLoading && visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No promo code yet.</p>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { type Motorbike } from "@/lib/motorbike";
import {
  createMotorbike,
  deleteMotorbike,
  duplicateMotorbike,
  reorderMotorbikes,
  setMotorbikeActive,
} from "@/lib/motorbike.functions";
import { formatIdr, moveItem } from "@/lib/transport";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CatalogueScopeNote,
  catalogueSearch,
  useCatalogueScope,
} from "@/components/admin/catalogue/scope";

export const Route = createFileRoute("/admin/_app/motorbikes/")({
  validateSearch: catalogueSearch,
  component: MotorbikeListPage,
});

type Row = Pick<
  Motorbike,
  | "id"
  | "internal_name"
  | "public_name"
  | "internal_reference"
  | "customer_price_idr"
  | "supplier_cost_idr"
  | "active"
  | "sort_order"
>;

function MotorbikeListPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();

  const create = useServerFn(createMotorbike);
  const setActive = useServerFn(setMotorbikeActive);
  const remove = useServerFn(deleteMotorbike);
  const duplicate = useServerFn(duplicateMotorbike);
  const reorder = useServerFn(reorderMotorbikes);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["motorbikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorbikes")
        .select(
          "id, internal_name, public_name, internal_reference, customer_price_idr, supplier_cost_idr, active, sort_order",
        )
        .order("sort_order")
        .order("internal_name");
      if (error) throw new Error(error.message);
      return data as Row[];
    },
  });

  const all = list.data ?? [];
  const rows = all.filter((m) => {
    const q = search.trim().toLowerCase();
    if (q && !`${m.internal_name} ${m.public_name ?? ""} ${m.internal_reference ?? ""}`.toLowerCase().includes(q))
      return false;
    if (status !== "all" && (status === "active") !== m.active) return false;
    return true;
  });
  const canReorder = canEdit && rows.length === all.length;

  async function submit() {
    if (draft === null) return;
    setBusy(true);
    try {
      const created = await create({
        data: {
          internal_name: draft.trim(),
          supplier_cost_idr: 0,
          customer_price_idr: 0,
          active: false,
        },
      });
      toast.success("Motorbike created.");
      setDraft(null);
      void navigate({ to: "/admin/motorbikes/$motorbikeId", params: { motorbikeId: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This motorbike could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(all, index, direction);
    if (next === all) return;
    try {
      await reorder({ data: { orderedIds: next.map((m) => m.id) } });
      void list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order could not be saved.");
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Motorbikes"]}
        title="Motorbikes"
        description="Internal catalogue of the motorbikes available for rental."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setDraft("")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New motorbike
            </Button>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: the motorbike catalogue is read-only.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Search</Label>
          <Input
            className="h-8 w-56 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name or reference"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {draft !== null && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">New motorbike</h3>
            <div>
              <Label className="text-xs">Internal name</Label>
              <Input className="h-8 max-w-sm text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void submit()}>
                {busy ? "Creating..." : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No motorbike matches these filters.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((m, index) => (
            <Card key={m.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <button
                  className="text-left"
                  onClick={() => navigate({ to: "/admin/motorbikes/$motorbikeId", params: { motorbikeId: m.id } })}
                >
                  <p className="text-sm font-medium">{m.internal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatIdr(m.customer_price_idr)}
                    {m.internal_reference ? ` · ${m.internal_reference}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <Badge variant={m.active ? "default" : "secondary"}>{m.active ? "Active" : "Inactive"}</Badge>
                  {canReorder && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void move(index, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void move(index, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/admin/motorbikes/$motorbikeId", params: { motorbikeId: m.id } })}
                  >
                    Open
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await setActive({ data: { id: m.id, active: !m.active } });
                          void list.refetch();
                        }}
                      >
                        {m.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Duplicate"
                        onClick={async () => {
                          try {
                            await duplicate({ data: { id: m.id } });
                            toast.success("Motorbike duplicated.");
                            void list.refetch();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "This motorbike could not be duplicated.");
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={async () => {
                          if (!confirm(`Delete "${m.internal_name}"? This cannot be undone.`)) return;
                          try {
                            await remove({ data: { id: m.id } });
                            toast.success("Motorbike deleted.");
                            void list.refetch();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "This motorbike could not be deleted.");
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

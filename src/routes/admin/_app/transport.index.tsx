import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  TRANSPORT_TYPES,
  TRANSPORT_TYPE_LABELS,
  moveItem,
  type Transport,
  type TransportType,
} from "@/lib/transport";
import {
  createTransport,
  deleteTransport,
  duplicateTransport,
  reorderTransports,
  setTransportActive,
} from "@/lib/transport.functions";
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

export const Route = createFileRoute("/admin/_app/transport/")({
  validateSearch: catalogueSearch,
  component: TransportListPage,
});

function TransportListPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();
  const { catalogue: catalogueId } = Route.useSearch();
  const scope = useCatalogueScope(catalogueId);

  const create = useServerFn(createTransport);
  const setActive = useServerFn(setTransportActive);
  const remove = useServerFn(deleteTransport);
  const duplicate = useServerFn(duplicateTransport);
  const reorder = useServerFn(reorderTransports);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [type, setType] = useState<"" | TransportType>("");
  const [draft, setDraft] = useState<{ internal_name: string; transport_type: TransportType } | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["transports", catalogueId ?? null],
    queryFn: async () => {
      let query = supabase
        .from("transports")
        .select(
          "id, transport_type, internal_name, public_name, internal_reference, origin, destination, min_travel_hours, max_travel_hours, active, sort_order",
        );
      // Only this catalogue's own items, when opened for one.
      if (catalogueId) query = query.eq("catalogue_id", catalogueId);
      const { data, error } = await query.order("sort_order").order("internal_name");
      if (error) throw new Error(error.message);
      return data as Pick<
        Transport,
        | "id"
        | "transport_type"
        | "internal_name"
        | "public_name"
        | "internal_reference"
        | "origin"
        | "destination"
        | "min_travel_hours"
        | "max_travel_hours"
        | "active"
        | "sort_order"
      >[];
    },
  });

  const all = list.data ?? [];
  const rows = all.filter((t) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !`${t.internal_name} ${t.public_name ?? ""} ${t.internal_reference ?? ""} ${t.origin ?? ""} ${t.destination ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (status !== "all" && (status === "active") !== t.active) return false;
    if (type && t.transport_type !== type) return false;
    return true;
  });
  const canReorder = canEdit && rows.length === all.length;

  async function submit() {
    if (!draft) return;
    setBusy(true);
    try {
      const created = await create({
        data: {
          internal_name: draft.internal_name.trim(),
          transport_type: draft.transport_type,
          active: false,
        },
      });
      toast.success("Transport created.");
      setDraft(null);
      void navigate({ to: "/admin/transport/$transportId", params: { transportId: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This transport could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(all, index, direction);
    if (next === all) return;
    try {
      await reorder({ data: { orderedIds: next.map((t) => t.id) } });
      void list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order could not be saved.");
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Transport"]}
        title="Transport"
        description="Internal transport catalogue: predefined routes and other locations."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setDraft({ internal_name: "", transport_type: "predefined_route" })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New transport
            </Button>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: the transport catalogue is read-only.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Search</Label>
          <Input
            className="h-8 w-56 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name, reference, origin or destination"
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
        <div>
          <Label className="text-xs">Type</Label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="">All types</option>
            {TRANSPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSPORT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {draft && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">New transport</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Internal name</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.internal_name}
                  onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <select
                  className={selectClass}
                  value={draft.transport_type}
                  onChange={(e) => setDraft({ ...draft, transport_type: e.target.value as TransportType })}
                >
                  {TRANSPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TRANSPORT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
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
        <p className="text-sm text-muted-foreground">No transport matches these filters.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((t, index) => (
            <Card key={t.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <button
                  className="text-left"
                  onClick={() => navigate({ to: "/admin/transport/$transportId", params: { transportId: t.id } })}
                >
                  <p className="text-sm font-medium">{t.internal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TRANSPORT_TYPE_LABELS[t.transport_type]}
                    {t.origin || t.destination ? ` · ${t.origin ?? "?"} → ${t.destination ?? "?"}` : ""}
                    {t.transport_type === "other_location" && t.min_travel_hours && t.max_travel_hours
                      ? ` · ${t.min_travel_hours}-${t.max_travel_hours} h`
                      : ""}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Active" : "Inactive"}</Badge>
                  {canReorder && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => void move(index, -1)}
                      >
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
                    onClick={() => navigate({ to: "/admin/transport/$transportId", params: { transportId: t.id } })}
                  >
                    Open
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await setActive({ data: { id: t.id, active: !t.active } });
                          void list.refetch();
                        }}
                      >
                        {t.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Duplicate"
                        onClick={async () => {
                          try {
                            await duplicate({ data: { id: t.id } });
                            toast.success("Transport duplicated.");
                            void list.refetch();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "This transport could not be duplicated.",
                            );
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
                          if (!confirm(`Delete "${t.internal_name}" and all of its prices? This cannot be undone.`))
                            return;
                          try {
                            await remove({ data: { id: t.id } });
                            toast.success("Transport deleted.");
                            void list.refetch();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "This transport could not be deleted.");
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

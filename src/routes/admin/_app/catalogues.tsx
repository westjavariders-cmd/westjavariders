import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOGUE_TEMPLATES,
  CATALOGUE_TEMPLATE_LABELS,
  CATALOGUE_TEMPLATE_SHORT,
  catalogueItemsRoute,
  type Catalogue,
  type CatalogueTemplate,
} from "@/lib/catalogues";
import {
  createCatalogue,
  deleteCatalogue,
  reorderCatalogues,
  setCatalogueActive,
  updateCatalogue,
} from "@/lib/catalogues.functions";
import { moveItem } from "@/lib/transport";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/catalogues")({
  component: CataloguesPage,
});

type Row = Catalogue & { items: number };

function CataloguesPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();

  const create = useServerFn(createCatalogue);
  const update = useServerFn(updateCatalogue);
  const setActive = useServerFn(setCatalogueActive);
  const remove = useServerFn(deleteCatalogue);
  const reorder = useServerFn(reorderCatalogues);

  const [draft, setDraft] = useState<{
    internal_name: string;
    public_name: string;
    description: string;
    template: CatalogueTemplate;
  } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["catalogues"],
    queryFn: async () => {
      const [catalogues, accommodations, transports, motorbikes] = await Promise.all([
        supabase.from("catalogues").select("*").order("sort_order").order("internal_name"),
        supabase.from("accommodations").select("catalogue_id"),
        supabase.from("transports").select("catalogue_id"),
        supabase.from("motorbikes").select("catalogue_id"),
      ]);
      if (catalogues.error) throw new Error(catalogues.error.message);
      const counts = new Map<string, number>();
      for (const rows of [accommodations.data ?? [], transports.data ?? [], motorbikes.data ?? []]) {
        for (const r of rows as { catalogue_id: string | null }[]) {
          if (r.catalogue_id) counts.set(r.catalogue_id, (counts.get(r.catalogue_id) ?? 0) + 1);
        }
      }
      return (catalogues.data ?? []).map((c) => ({ ...c, items: counts.get(c.id) ?? 0 })) as Row[];
    },
  });

  const rows = list.data ?? [];

  function openItems(c: Row) {
    void navigate({
      to: catalogueItemsRoute(c.template as CatalogueTemplate),
      search: { catalogue: c.id } as never,
    });
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    try {
      await create({
        data: {
          internal_name: draft.internal_name.trim(),
          public_name: draft.public_name,
          description: draft.description,
          people_label: "",
          hours_label: "",
          template: draft.template,
          active: false,
        },
      });

      toast.success("Catalogue created.");
      setDraft(null);
      void list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This catalogue could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await update({
        data: {
          id: editing.id,
          internal_name: editing.internal_name,
          public_name: editing.public_name ?? "",
          description: editing.description ?? "",
          people_label: (editing as any).people_label ?? "",
          hours_label: (editing as any).hours_label ?? "",
          active: editing.active,
        },
      });

      toast.success("Catalogue saved.");
      setEditing(null);
      void list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This catalogue could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = moveItem(rows, index, direction);
    if (next === rows) return;
    try {
      await reorder({ data: { orderedIds: next.map((c) => c.id) } });
      void list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order could not be saved.");
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Catalogues"]}
        title="Catalogues"
        description="Reusable lists of items the configurator can offer. Each catalogue is built from one of the three structures."
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() =>
                setDraft({ internal_name: "", public_name: "", description: "", template: "motorbike" })
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New catalogue
            </Button>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: catalogues are read-only.
        </p>
      )}

      {draft && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">New catalogue</h3>
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
                <Label className="text-xs">Customer-facing name (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.public_name}
                  onChange={(e) => setDraft({ ...draft, public_name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Structure</Label>
                <select
                  className={selectClass}
                  value={draft.template}
                  onChange={(e) =>
                    setDraft({ ...draft, template: e.target.value as CatalogueTemplate })
                  }
                >
                  {CATALOGUE_TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {CATALOGUE_TEMPLATE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  The structure decides which fields and prices the items of this catalogue have. It
                  cannot be changed afterwards.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
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

      {editing && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">Edit catalogue</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Internal name</Label>
                <Input
                  className="h-8 text-xs"
                  value={editing.internal_name}
                  onChange={(e) => setEditing({ ...editing, internal_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Customer-facing name (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={editing.public_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, public_name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void saveEdit()}>
                {busy ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No catalogue yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c, index) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <button className="text-left" onClick={() => openItems(c)}>
                  <p className="text-sm font-medium">{c.internal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATALOGUE_TEMPLATE_SHORT[c.template as CatalogueTemplate]} · {c.items}{" "}
                    {c.items === 1 ? "item" : "items"}
                    {c.public_name ? ` · shown as "${c.public_name}"` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <Badge variant={c.active ? "default" : "secondary"}>
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                  {canEdit && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openItems(c)}>
                    Open items
                  </Button>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await setActive({ data: { id: c.id, active: !c.active } });
                            void list.refetch();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "The status could not be changed.",
                            );
                          }
                        }}
                      >
                        {c.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={async () => {
                          if (!confirm(`Delete "${c.internal_name}"? This cannot be undone.`)) return;
                          try {
                            await remove({ data: { id: c.id } });
                            toast.success("Catalogue deleted.");
                            void list.refetch();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "This catalogue could not be deleted.",
                            );
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  CATALOGUE_TEMPLATES,
  CATALOGUE_TEMPLATE_LABELS,
  CATALOGUE_TEMPLATE_ROUTES,
  type Catalogue,
  type CatalogueTemplate,
} from "@/lib/catalogue";
import {
  createCatalogue,
  deleteCatalogue,
  setCatalogueActive,
  updateCatalogue,
} from "@/lib/catalogue.functions";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/catalogues")({
  component: CataloguesPage,
});

const TEMPLATE_SHORT: Record<CatalogueTemplate, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  motorbike: "Simple items",
};

function CataloguesPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();

  const create = useServerFn(createCatalogue);
  const update = useServerFn(updateCatalogue);
  const setActive = useServerFn(setCatalogueActive);
  const remove = useServerFn(deleteCatalogue);

  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<{ template: CatalogueTemplate; internal_name: string } | null>(
    null,
  );
  const [editing, setEditing] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["catalogues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("id, template, internal_name, public_name, description, active, sort_order")
        .order("sort_order")
        .order("internal_name");
      if (error) throw new Error(error.message);
      return data as Catalogue[];
    },
  });

  const counts = useQuery({
    queryKey: ["catalogue-item-counts"],
    queryFn: async () => {
      const [a, t, m] = await Promise.all([
        supabase.from("accommodations").select("catalogue_id"),
        supabase.from("transports").select("catalogue_id"),
        supabase.from("motorbikes").select("catalogue_id"),
      ]);
      const out: Record<string, number> = {};
      for (const res of [a, t, m]) {
        for (const row of (res.data ?? []) as { catalogue_id: string | null }[]) {
          if (!row.catalogue_id) continue;
          out[row.catalogue_id] = (out[row.catalogue_id] ?? 0) + 1;
        }
      }
      return out;
    },
  });

  const rows = list.data ?? [];

  async function submitNew() {
    if (!creating) return;
    setBusy(true);
    try {
      await create({
        data: {
          template: creating.template,
          internal_name: creating.internal_name.trim(),
          public_name: null,
          description: null,
          active: true,
        },
      });
      toast.success("Catalogue created.");
      setCreating(null);
      void list.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This catalogue could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Catalogues"]}
        title="Catalogues"
        description="Each catalogue follows one of three behaviours. Items are managed in the matching editor."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setCreating({ template: "accommodation", internal_name: "" })}>
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

      {creating && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">New catalogue</h3>
            <div>
              <Label className="text-xs">Behaviour</Label>
              <select
                className={selectClass}
                value={creating.template}
                onChange={(e) =>
                  setCreating({ ...creating, template: e.target.value as CatalogueTemplate })
                }
              >
                {CATALOGUE_TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {CATALOGUE_TEMPLATE_LABELS[t]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                The behaviour is fixed once the catalogue exists, because it decides how its items
                are priced.
              </p>
            </div>
            <div>
              <Label className="text-xs">Internal name</Label>
              <Input
                className="h-8 max-w-sm text-xs"
                value={creating.internal_name}
                onChange={(e) => setCreating({ ...creating, internal_name: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void submitNew()}>
                {busy ? "Creating..." : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(null)}>
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
          {rows.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.internal_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TEMPLATE_SHORT[c.template]} · {counts.data?.[c.id] ?? 0} item
                      {(counts.data?.[c.id] ?? 0) === 1 ? "" : "s"}
                      {c.public_name ? ` · shown as “${c.public_name}”` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate({ to: CATALOGUE_TEMPLATE_ROUTES[c.template] as never })
                      }
                    >
                      Manage items
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(editing === c.id ? null : c.id)}
                        >
                          {editing === c.id ? "Close" : "Edit"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await setActive({ data: { id: c.id, active: !c.active } });
                              void list.refetch();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "This could not be saved.");
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
                            if (!confirm(`Delete "${c.internal_name}"?`)) return;
                            try {
                              await remove({ data: { id: c.id } });
                              toast.success("Catalogue deleted.");
                              void list.refetch();
                              void counts.refetch();
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
                </div>

                {canEdit && editing === c.id && (
                  <CatalogueEditor
                    catalogue={c}
                    onSaved={() => {
                      setEditing(null);
                      void list.refetch();
                    }}
                    save={update}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogueEditor({
  catalogue,
  onSaved,
  save,
}: {
  catalogue: Catalogue;
  onSaved: () => void;
  save: (args: { data: Record<string, unknown> }) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({
    internal_name: catalogue.internal_name,
    public_name: catalogue.public_name ?? "",
    description: catalogue.description ?? "",
    active: catalogue.active,
  });
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3 border-t border-border pt-3">
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
          <Label className="text-xs">Public name (optional)</Label>
          <Input
            className="h-8 text-xs"
            value={draft.public_name}
            onChange={(e) => setDraft({ ...draft, public_name: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Description (optional)</Label>
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await save({
              data: {
                id: catalogue.id,
                internal_name: draft.internal_name,
                public_name: draft.public_name,
                description: draft.description,
                active: draft.active,
              },
            });
            toast.success("Catalogue saved.");
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "This catalogue could not be saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}

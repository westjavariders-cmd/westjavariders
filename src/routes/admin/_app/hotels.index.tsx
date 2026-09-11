import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCOMMODATION_TYPES,
  ACCOMMODATION_TYPE_LABELS,
  type AccommodationType,
} from "@/lib/accommodation";
import {
  createAccommodation,
  deleteAccommodation,
  setAccommodationActive,
} from "@/lib/accommodation.functions";
import { selectClass } from "@/components/admin/configurator/ui";
import {
  CatalogueScopeBanner,
  catalogueSearchSchema,
} from "@/components/admin/catalogue/CatalogueScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/hotels/")({
  validateSearch: catalogueSearchSchema,
  component: AccommodationListPage,
});

function AccommodationListPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();
  const { catalogue: catalogueId } = Route.useSearch();

  const create = useServerFn(createAccommodation);
  const setActive = useServerFn(setAccommodationActive);
  const remove = useServerFn(deleteAccommodation);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [type, setType] = useState<"" | AccommodationType>("");
  const [draft, setDraft] = useState<{ internal_name: string; accommodation_type: AccommodationType } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ["accommodations", catalogueId ?? null],
    queryFn: async () => {
      let query = supabase
        .from("accommodations")
        .select("id, accommodation_type, internal_name, public_name, internal_reference, location, active, accommodation_rooms(id, active)");
      if (catalogueId) query = query.eq("catalogue_id", catalogueId);
      const { data, error } = await query.order("internal_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const rows = (list.data ?? []).filter((a) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !`${a.internal_name} ${a.public_name ?? ""} ${a.internal_reference ?? ""} ${a.location ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (status !== "all" && (status === "active") !== a.active) return false;
    if (type && a.accommodation_type !== type) return false;
    return true;
  });

  async function submit() {
    if (!draft) return;
    setBusy(true);
    try {
      const created = await create({
        data: {
          internal_name: draft.internal_name.trim(),
          accommodation_type: draft.accommodation_type,
          active: false,
          catalogue_id: catalogueId ?? null,
        },
      });
      toast.success("Accommodation created.");
      setDraft(null);
      void navigate({ to: "/admin/hotels/$accommodationId", params: { accommodationId: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This accommodation could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Hotels / Rooms"]}
        title="Hotels / Rooms"
        description="Internal accommodation catalogue: hotels, rooms and beach camping."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setDraft({ internal_name: "", accommodation_type: "hotel" })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New accommodation
            </Button>
          ) : undefined
        }
      />

      <CatalogueScopeBanner catalogueId={catalogueId} />



      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: the accommodation catalogue is read-only.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-xs">Search</Label>
          <Input
            className="h-8 w-56 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name, reference or area"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <select
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="">All types</option>
            {ACCOMMODATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOMMODATION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {draft && (
        <Card className="mb-4">
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-medium">New accommodation</h3>
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
                  value={draft.accommodation_type}
                  onChange={(e) =>
                    setDraft({ ...draft, accommodation_type: e.target.value as AccommodationType })
                  }
                >
                  {ACCOMMODATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACCOMMODATION_TYPE_LABELS[t]}
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
        <p className="text-sm text-muted-foreground">No accommodation matches these filters.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <button
                  className="text-left"
                  onClick={() =>
                    navigate({ to: "/admin/hotels/$accommodationId", params: { accommodationId: a.id } })
                  }
                >
                  <p className="text-sm font-medium">{a.internal_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ACCOMMODATION_TYPE_LABELS[a.accommodation_type as AccommodationType]}
                    {a.location ? ` · ${a.location}` : ""} ·{" "}
                    {a.accommodation_rooms.filter((r) => r.active).length} active of{" "}
                    {a.accommodation_rooms.length}
                  </p>
                </button>
                <div className="flex items-center gap-1">
                  <Badge variant={a.active ? "default" : "secondary"}>
                    {a.active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate({ to: "/admin/hotels/$accommodationId", params: { accommodationId: a.id } })
                    }
                  >
                    Open
                  </Button>
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await setActive({ data: { id: a.id, active: !a.active } });
                          void list.refetch();
                        }}
                      >
                        {a.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete "${a.internal_name}" and all of its rooms and photos? This cannot be undone.`,
                            )
                          )
                            return;
                          try {
                            await remove({ data: { id: a.id } });
                            toast.success("Accommodation deleted.");
                            void list.refetch();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "This accommodation could not be deleted.",
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

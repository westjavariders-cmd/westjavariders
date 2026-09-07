import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCOMMODATION_TYPES,
  ACCOMMODATION_TYPE_LABELS,
  type Accommodation,
  type AccommodationType,
} from "@/lib/accommodation";
import { setAccommodationActive, updateAccommodation } from "@/lib/accommodation.functions";
import { PhotoManager } from "@/components/admin/accommodation/PhotoManager";
import { RoomsPanel } from "@/components/admin/accommodation/RoomsPanel";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/_app/hotels/$accommodationId")({
  component: AccommodationEditorPage,
});

type Form = {
  accommodation_type: AccommodationType;
  internal_name: string;
  public_name: string;
  internal_reference: string;
  description: string;
  location: string;
  supplier_contact: string;
  internal_notes: string;
  active: boolean;
};

function AccommodationEditorPage() {
  const { accommodationId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();

  const update = useServerFn(updateAccommodation);
  const setActive = useServerFn(setAccommodationActive);

  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const record = useQuery({
    queryKey: ["accommodation", accommodationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accommodations")
        .select("*")
        .eq("id", accommodationId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Accommodation | null;
    },
  });

  useEffect(() => {
    const a = record.data;
    if (!a || form) return;
    setForm({
      accommodation_type: a.accommodation_type,
      internal_name: a.internal_name,
      public_name: a.public_name ?? "",
      internal_reference: a.internal_reference ?? "",
      description: a.description ?? "",
      location: a.location ?? "",
      supplier_contact: a.supplier_contact ?? "",
      internal_notes: a.internal_notes ?? "",
      active: a.active,
    });
  }, [record.data, form]);

  if (record.isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!record.data)
    return (
      <div>
        <p className="text-sm text-muted-foreground">This accommodation no longer exists.</p>
        <Button size="sm" className="mt-3" onClick={() => navigate({ to: "/admin/hotels" })}>
          Back to the list
        </Button>
      </div>
    );
  if (!form) return null;

  const isCamping = form.accommodation_type === "beach_camping";

  async function save() {
    setBusy(true);
    try {
      await update({ data: { id: accommodationId, ...form! } });
      toast.success("Accommodation saved.");
      void record.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This accommodation could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Hotels / Rooms", form.internal_name]}
        title={form.internal_name}
        description={ACCOMMODATION_TYPE_LABELS[form.accommodation_type]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={record.data.active ? "default" : "secondary"}>
              {record.data.active ? "Active" : "Inactive"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/admin/hotels" })}>
              Back
            </Button>
            {canEdit && (
              <Button size="sm" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        }
      />

      {!canEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as STAFF: this accommodation is read-only.
        </p>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="rooms">{isCamping ? "Camping options" : "Rooms"}</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <select
                    className={selectClass}
                    value={form.accommodation_type}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setForm({ ...form, accommodation_type: e.target.value as AccommodationType })
                    }
                  >
                    {ACCOMMODATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ACCOMMODATION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Internal name</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={form.internal_name}
                    onChange={(e) => setForm({ ...form, internal_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Public name</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={form.public_name}
                    onChange={(e) => setForm({ ...form, public_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Internal reference</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={form.internal_reference}
                    onChange={(e) => setForm({ ...form, internal_reference: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Location / area</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Customer description</Label>
                <Textarea
                  className="text-xs"
                  rows={4}
                  disabled={!canEdit}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="rounded-md border border-dashed p-3">
                <p className="mb-2 text-xs font-medium">Internal only — never shown to customers</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Supplier / internal contact</Label>
                    <Textarea
                      className="text-xs"
                      rows={2}
                      disabled={!canEdit}
                      value={form.supplier_contact}
                      onChange={(e) => setForm({ ...form, supplier_contact: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Internal notes</Label>
                    <Textarea
                      className="text-xs"
                      rows={3}
                      disabled={!canEdit}
                      value={form.internal_notes}
                      onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <PhotoManager owner={{ accommodationId }} canEdit={canEdit} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          <RoomsPanel
            accommodationId={accommodationId}
            accommodationActive={record.data.active}
            isCamping={isCamping}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm">
                This accommodation is {record.data.active ? "active" : "inactive"}.
              </p>
              <p className="text-xs text-muted-foreground">
                While it is inactive, none of its rooms can be selected commercially. Deactivating never
                deletes anything.
              </p>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await setActive({ data: { id: accommodationId, active: !record.data!.active } });
                    void record.refetch();
                  }}
                >
                  {record.data.active ? "Deactivate" : "Activate"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

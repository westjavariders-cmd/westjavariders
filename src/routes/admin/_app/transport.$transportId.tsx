import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  TRANSPORT_TYPES,
  TRANSPORT_TYPE_LABELS,
  TRAVEL_HOUR_OPTIONS,
  type Transport,
  type TransportType,
} from "@/lib/transport";
import { duplicateTransport, setTransportActive, updateTransport } from "@/lib/transport.functions";
import { TransportPricing } from "@/components/admin/transport/TransportPricing";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/_app/transport/$transportId")({
  component: TransportEditorPage,
});

type Form = {
  transport_type: TransportType;
  internal_name: string;
  public_name: string;
  internal_reference: string;
  description: string;
  origin: string;
  destination: string;
  min_travel_hours: string;
  max_travel_hours: string;
  internal_notes: string;
  active: boolean;
};

function TransportEditorPage() {
  const { transportId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();

  const update = useServerFn(updateTransport);
  const setActive = useServerFn(setTransportActive);
  const duplicate = useServerFn(duplicateTransport);

  const [form, setForm] = useState<{ id: string; values: Form } | null>(null);
  const [busy, setBusy] = useState(false);

  const record = useQuery({
    queryKey: ["transport", transportId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transports").select("*").eq("id", transportId).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Transport | null;
    },
  });

  useEffect(() => {
    const t = record.data;
    if (!t || form?.id === transportId) return;
    setForm({
      id: transportId,
      values: {
        transport_type: t.transport_type,
        internal_name: t.internal_name,
        public_name: t.public_name ?? "",
        internal_reference: t.internal_reference ?? "",
        description: t.description ?? "",
        origin: t.origin ?? "",
        destination: t.destination ?? "",
        min_travel_hours: t.min_travel_hours == null ? "" : String(t.min_travel_hours),
        max_travel_hours: t.max_travel_hours == null ? "" : String(t.max_travel_hours),
        internal_notes: t.internal_notes ?? "",
        active: t.active,
      },
    });
  }, [record.data, form, transportId]);


  if (record.isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!record.data)
    return (
      <div>
        <p className="text-sm text-muted-foreground">This transport no longer exists.</p>
        <Button size="sm" className="mt-3" onClick={() => navigate({ to: "/admin/transport" })}>
          Back to the list
        </Button>
      </div>
    );
  if (!form) return null;

  const isOther = form.transport_type === "other_location";

  async function save() {
    setBusy(true);
    try {
      const { min_travel_hours, max_travel_hours, ...rest } = form!;
      await update({
        data: {
          id: transportId,
          ...rest,
          min_travel_hours: min_travel_hours === "" ? null : Number(min_travel_hours),
          max_travel_hours: max_travel_hours === "" ? null : Number(max_travel_hours),
        },
      });
      toast.success("Transport saved.");
      void record.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This transport could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Transport", form.internal_name]}
        title={form.internal_name}
        description={TRANSPORT_TYPE_LABELS[form.transport_type]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={record.data.active ? "default" : "secondary"}>
              {record.data.active ? "Active" : "Inactive"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/admin/transport" })}>
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
          You are signed in as STAFF: this transport is read-only.
        </p>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
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
                    value={form.transport_type}
                    disabled={!canEdit}
                    onChange={(e) => setForm({ ...form, transport_type: e.target.value as TransportType })}
                  >
                    {TRANSPORT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TRANSPORT_TYPE_LABELS[t]}
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
                  <Label className="text-xs">Origin</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Destination</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  />
                </div>
                {isOther && (
                  <>
                    <div>
                      <Label className="text-xs">Minimum travel hours</Label>
                      <select
                        className={selectClass}
                        disabled={!canEdit}
                        value={form.min_travel_hours}
                        onChange={(e) => setForm({ ...form, min_travel_hours: e.target.value })}
                      >
                        <option value="">Not set</option>
                        {TRAVEL_HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Maximum travel hours</Label>
                      <select
                        className={selectClass}
                        disabled={!canEdit}
                        value={form.max_travel_hours}
                        onChange={(e) => setForm({ ...form, max_travel_hours: e.target.value })}
                      >
                        <option value="">Not set</option>
                        {TRAVEL_HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
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
                <Label className="text-xs">Internal notes</Label>
                <Textarea
                  className="text-xs"
                  rows={3}
                  disabled={!canEdit}
                  value={form.internal_notes}
                  onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <TransportPricing
            transportId={transportId}
            transportType={record.data.transport_type}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm">This transport is {record.data.active ? "active" : "inactive"}.</p>
              <p className="text-xs text-muted-foreground">
                While it is inactive it cannot be used commercially. Deactivating never deletes anything.
              </p>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await setActive({ data: { id: transportId, active: !record.data!.active } });
                      void record.refetch();
                    }}
                  >
                    {record.data.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const copy = await duplicate({ data: { id: transportId } });
                        toast.success("Transport duplicated.");
                        void navigate({
                          to: "/admin/transport/$transportId",
                          params: { transportId: copy.id },
                        });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "This transport could not be duplicated.");
                      }
                    }}
                  >
                    Duplicate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

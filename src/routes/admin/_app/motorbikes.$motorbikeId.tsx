import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  MOTORBIKE_PHOTO_BUCKET,
  motorbikeMargin,
  motorbikePhotoPath,
  type Motorbike,
} from "@/lib/motorbike";
import {
  duplicateMotorbike,
  setMotorbikeActive,
  setMotorbikePhoto,
  updateMotorbike,
} from "@/lib/motorbike.functions";
import { formatIdr, parseIdr } from "@/lib/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/_app/motorbikes/$motorbikeId")({
  component: MotorbikeEditorPage,
});

type Form = {
  internal_name: string;
  public_name: string;
  internal_reference: string;
  description: string;
  internal_notes: string;
  supplier_cost_idr: string;
  customer_price_idr: string;
  active: boolean;
};

function MotorbikeEditorPage() {
  const { motorbikeId } = Route.useParams();
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const navigate = useNavigate();

  const update = useServerFn(updateMotorbike);
  const setActive = useServerFn(setMotorbikeActive);
  const duplicate = useServerFn(duplicateMotorbike);
  const savePhoto = useServerFn(setMotorbikePhoto);

  const [form, setForm] = useState<{ id: string; values: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const record = useQuery({
    queryKey: ["motorbike", motorbikeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("motorbikes").select("*").eq("id", motorbikeId).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Motorbike | null;
    },
  });

  const photo = useQuery({
    queryKey: ["motorbike-photo", motorbikeId, record.data?.photo_path],
    enabled: Boolean(record.data?.photo_path),
    queryFn: async () => {
      const { data } = await supabase.storage
        .from(MOTORBIKE_PHOTO_BUCKET)
        .createSignedUrl(record.data!.photo_path!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  useEffect(() => {
    const m = record.data;
    if (!m || form?.id === motorbikeId) return;
    setForm({
      id: motorbikeId,
      values: {
        internal_name: m.internal_name,
        public_name: m.public_name ?? "",
        internal_reference: m.internal_reference ?? "",
        description: m.description ?? "",
        internal_notes: m.internal_notes ?? "",
        supplier_cost_idr: String(m.supplier_cost_idr),
        customer_price_idr: String(m.customer_price_idr),
        active: m.active,
      },
    });
  }, [record.data, form, motorbikeId]);

  if (record.isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!record.data)
    return (
      <div>
        <p className="text-sm text-muted-foreground">This motorbike no longer exists.</p>
        <Button size="sm" className="mt-3" onClick={() => navigate({ to: "/admin/motorbikes" })}>
          Back to the list
        </Button>
      </div>
    );
  if (!form || form.id !== motorbikeId) return null;

  const values = form.values;
  const setValues = (next: Form) => setForm({ id: motorbikeId, values: next });

  const supplier = parseIdr(values.supplier_cost_idr);
  const customer = parseIdr(values.customer_price_idr);
  const margin = supplier === null || customer === null ? null : motorbikeMargin(supplier, customer);

  async function save() {
    if (supplier === null || customer === null) {
      toast.error("Prices must be whole Rupiah amounts.");
      return;
    }
    setBusy(true);
    try {
      await update({
        data: {
          id: motorbikeId,
          internal_name: values.internal_name,
          public_name: values.public_name,
          internal_reference: values.internal_reference,
          description: values.description,
          internal_notes: values.internal_notes,
          supplier_cost_idr: supplier,
          customer_price_idr: customer,
          active: values.active,
        },
      });
      toast.success("Motorbike saved.");
      void record.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This motorbike could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = motorbikePhotoPath(motorbikeId, file.name);
      const { error } = await supabase.storage.from(MOTORBIKE_PHOTO_BUCKET).upload(path, file);
      if (error) throw new Error(error.message);
      await savePhoto({ data: { id: motorbikeId, photo_path: path } });
      toast.success("Photo saved.");
      void record.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The photo could not be uploaded.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        breadcrumb={["Motorbikes", values.internal_name]}
        title={values.internal_name}
        description="Motorbike rental catalogue item"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={record.data.active ? "default" : "secondary"}>
              {record.data.active ? "Active" : "Inactive"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/admin/motorbikes" })}>
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
        <p className="mb-4 text-sm text-muted-foreground">You are signed in as STAFF: this motorbike is read-only.</p>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Internal name</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={values.internal_name}
                    onChange={(e) => setValues({ ...values, internal_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Public name</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={values.public_name}
                    onChange={(e) => setValues({ ...values, public_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Reference</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={values.internal_reference}
                    onChange={(e) => setValues({ ...values, internal_reference: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Short public description</Label>
                <Textarea
                  className="text-xs"
                  rows={3}
                  disabled={!canEdit}
                  value={values.description}
                  onChange={(e) => setValues({ ...values, description: e.target.value })}
                />
              </div>

              <div className="rounded-md border border-dashed p-3">
                <p className="mb-2 text-xs font-medium">Internal only — never shown to customers</p>
                <Label className="text-xs">Internal notes</Label>
                <Textarea
                  className="text-xs"
                  rows={3}
                  disabled={!canEdit}
                  value={values.internal_notes}
                  onChange={(e) => setValues({ ...values, internal_notes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photo" className="mt-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">
                One optional main photo. Photos are stored privately and are only visible to signed-in staff.
              </p>
              {record.data.photo_path ? (
                photo.data ? (
                  <img
                    src={photo.data}
                    alt={values.public_name || values.internal_name}
                    className="h-40 w-full max-w-sm rounded-md border object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Preview unavailable.</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">No photo yet.</p>
              )}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void upload(e.target.files)}
                  />
                  <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploading ? "Uploading..." : record.data.photo_path ? "Replace photo" : "Add photo"}
                  </Button>
                  {record.data.photo_path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await savePhoto({ data: { id: motorbikeId, photo_path: null } });
                        toast.success("Photo removed.");
                        void record.refetch();
                      }}
                    >
                      Remove photo
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Supplier cost (IDR)</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={values.supplier_cost_idr}
                    onChange={(e) => setValues({ ...values, supplier_cost_idr: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer rental price (IDR)</Label>
                  <Input
                    className="h-8 text-xs"
                    disabled={!canEdit}
                    value={values.customer_price_idr}
                    onChange={(e) => setValues({ ...values, customer_price_idr: e.target.value })}
                  />
                </div>
              </div>
              <div className="rounded-md border p-3 text-xs">
                {margin === null ? (
                  <p className="text-destructive">Prices must be whole Rupiah amounts.</p>
                ) : (
                  <div className="grid gap-1 sm:grid-cols-4">
                    <p>Customer price: {formatIdr(customer!)}</p>
                    <p>Internal cost: {formatIdr(supplier!)}</p>
                    <p>Margin: {formatIdr(margin.amount)}</p>
                    <p>Margin %: {margin.percentage.toFixed(1)}%</p>
                  </div>
                )}
                <p className="mt-2 text-muted-foreground">
                  Margin is informational only and is never shown to customers.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm">This motorbike is {record.data.active ? "active" : "inactive"}.</p>
              <p className="text-xs text-muted-foreground">
                Order in the list: #{record.data.sort_order + 1}. Deactivating never deletes anything.
              </p>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await setActive({ data: { id: motorbikeId, active: !record.data!.active } });
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
                        const copy = await duplicate({ data: { id: motorbikeId } });
                        toast.success("Motorbike duplicated.");
                        void navigate({
                          to: "/admin/motorbikes/$motorbikeId",
                          params: { motorbikeId: copy.id },
                        });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "This motorbike could not be duplicated.");
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

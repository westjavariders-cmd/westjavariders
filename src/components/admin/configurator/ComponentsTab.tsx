import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { addComponentFromTemplate } from "@/lib/catalog.functions";
import { recordAdminAction } from "@/lib/admin-audit";
import { UNIT_BASES, type ProductBundle, type ProductComponent } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { selectClass } from "./ui";

type Props = { bundle: ProductBundle; canEdit: boolean; reload: () => void };

const numeric = (v: string) => (v.trim() === "" ? null : Number(v));

export function ComponentsTab({ bundle, canEdit, reload }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("");
  const addFromTemplate = useServerFn(addComponentFromTemplate);

  const templates = useQuery({
    queryKey: ["component_templates", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_templates")
        .select("id, internal_name, is_active")
        .eq("is_active", true)
        .order("internal_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  async function addBlank() {
    const { error } = await supabase.from("product_components").insert({
      product_id: bundle.product.id,
      internal_name: "New component",
      display_order: bundle.components.length,
    });
    if (error) return toast.error(error.message);
    await recordAdminAction("product_component_added", "product_components", bundle.product.internal_name, {
      source: "blank",
    });
    toast.success("Component added.");
    reload();
  }

  async function useTemplate() {
    if (!templateId) return;
    try {
      await addFromTemplate({ data: { productId: bundle.product.id, templateId } });
      toast.success("Component copied from the template. It is now independent.");
      setTemplateId("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This component could not be added.");
    }
  }

  async function duplicate(c: ProductComponent) {
    const { id, created_at, updated_at, ...rest } = c;
    const { error } = await supabase.from("product_components").insert({
      ...rest,
      internal_name: `Copy of ${c.internal_name}`,
      display_order: bundle.components.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Component duplicated.");
    reload();
  }

  async function remove(c: ProductComponent) {
    const { error } = await supabase.from("product_components").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Component removed.");
    reload();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <Label className="text-xs">Add from template</Label>
            <select
              className={selectClass}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Choose a template…</option>
              {(templates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.internal_name}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={useTemplate} disabled={!templateId}>
            Copy into product
          </Button>
          <Button size="sm" variant="outline" onClick={addBlank}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New component
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Components are copies. Editing a template later never changes components already added.
      </p>

      {bundle.components.length === 0 && (
        <p className="text-sm text-muted-foreground">No components yet.</p>
      )}

      <div className="space-y-3">
        {bundle.components.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-medium"
                  onClick={() => setOpenId(openId === c.id ? null : c.id)}
                >
                  {c.internal_name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {UNIT_BASES.find((u) => u.value === c.unit_basis)?.label}
                    {c.is_active ? "" : " · inactive"}
                  </span>
                </button>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => duplicate(c)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {openId === c.id && (
                <ComponentForm component={c} canEdit={canEdit} reload={reload} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ComponentForm({
  component,
  canEdit,
  reload,
}: {
  component: ProductComponent;
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    internal_name: component.internal_name,
    customer_name: component.customer_name ?? "",
    customer_description: component.customer_description ?? "",
    unit_basis: component.unit_basis as string,
    internal_cost: String(component.internal_cost ?? "0"),
    customer_price: String(component.customer_price ?? "0"),
    min_quantity: String(component.min_quantity ?? "0"),
    max_quantity: component.max_quantity == null ? "" : String(component.max_quantity),
    default_quantity: component.default_quantity == null ? "" : String(component.default_quantity),
    season_eligible: component.season_eligible,
    promo_eligible: component.promo_eligible,
    is_active: component.is_active,
    display_order: String(component.display_order),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("product_components")
      .update({
        internal_name: draft.internal_name.trim(),
        customer_name: draft.customer_name.trim() || null,
        customer_description: draft.customer_description.trim() || null,
        unit_basis: draft.unit_basis as never,
        internal_cost: Number(draft.internal_cost || 0),
        customer_price: Number(draft.customer_price || 0),
        min_quantity: Number(draft.min_quantity || 0),
        max_quantity: numeric(draft.max_quantity),
        default_quantity: numeric(draft.default_quantity),
        season_eligible: draft.season_eligible,
        promo_eligible: draft.promo_eligible,
        is_active: draft.is_active,
        display_order: Number(draft.display_order || 0),
      })
      .eq("id", component.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await recordAdminAction("product_component_updated", "product_components", draft.internal_name);
    toast.success("Component saved.");
    reload();
  }

  const set = (k: keyof typeof draft) => (v: string | boolean) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <div>
        <Label className="text-xs">Internal name</Label>
        <Input
          value={draft.internal_name}
          disabled={!canEdit}
          onChange={(e) => set("internal_name")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Customer-facing name</Label>
        <Input
          value={draft.customer_name}
          disabled={!canEdit}
          onChange={(e) => set("customer_name")(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Customer-facing description</Label>
        <Textarea
          rows={2}
          value={draft.customer_description}
          disabled={!canEdit}
          onChange={(e) => set("customer_description")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Unit basis</Label>
        <select
          className={selectClass}
          value={draft.unit_basis}
          disabled={!canEdit}
          onChange={(e) => set("unit_basis")(e.target.value)}
        >
          {UNIT_BASES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs">Display order</Label>
        <Input
          value={draft.display_order}
          disabled={!canEdit}
          onChange={(e) => set("display_order")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Internal cost (IDR)</Label>
        <Input
          inputMode="decimal"
          value={draft.internal_cost}
          disabled={!canEdit}
          onChange={(e) => set("internal_cost")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Customer price (IDR)</Label>
        <Input
          inputMode="decimal"
          value={draft.customer_price}
          disabled={!canEdit}
          onChange={(e) => set("customer_price")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Minimum quantity</Label>
        <Input
          inputMode="decimal"
          value={draft.min_quantity}
          disabled={!canEdit}
          onChange={(e) => set("min_quantity")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Maximum quantity</Label>
        <Input
          inputMode="decimal"
          value={draft.max_quantity}
          disabled={!canEdit}
          onChange={(e) => set("max_quantity")(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs">Default quantity</Label>
        <Input
          inputMode="decimal"
          value={draft.default_quantity}
          disabled={!canEdit}
          onChange={(e) => set("default_quantity")(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-1 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.season_eligible}
            disabled={!canEdit}
            onCheckedChange={(v) => set("season_eligible")(v)}
          />
          Season eligible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.promo_eligible}
            disabled={!canEdit}
            onCheckedChange={(v) => set("promo_eligible")(v)}
          />
          Promo eligible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.is_active}
            disabled={!canEdit}
            onCheckedChange={(v) => set("is_active")(v)}
          />
          Active
        </label>
      </div>
      {canEdit && (
        <div className="sm:col-span-2">
          <Button size="sm" onClick={save} disabled={saving}>
            Save component
          </Button>
        </div>
      )}
    </div>
  );
}

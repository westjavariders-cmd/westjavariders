import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import { UNIT_BASES, type ComponentTemplate } from "@/lib/catalog";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_app/component-templates")({
  component: TemplatesPage,
});

const numeric = (v: string) => (v.trim() === "" ? null : Number(v));

function TemplatesPage() {
  const { adminSession } = Route.useRouteContext();
  const canEdit = adminSession.isAdmin;
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["component_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_templates")
        .select("*")
        .order("internal_name");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  async function add() {
    const { error } = await supabase
      .from("component_templates")
      .insert({ internal_name: "New template" });
    if (error) return toast.error(error.message);
    await recordAdminAction("component_template_created", "component_templates", "New template");
    list.refetch();
  }

  const rows = (list.data ?? []).filter((t) =>
    t.internal_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        breadcrumb={["Products"]}
        title="Component Templates"
        description="Reusable starting points. Adding one to a product copies its values."
        actions={
          canEdit && (
            <Button size="sm" onClick={add}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New template
            </Button>
          )
        }
      />

      <Input
        className="mb-4 sm:max-w-xs"
        placeholder="Search templates"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {rows.length === 0 && <p className="text-sm text-muted-foreground">No template yet.</p>}

      <div className="space-y-2">
        {rows.map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-3 p-4">
              <button
                type="button"
                className="text-left text-sm font-medium"
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
              >
                {t.internal_name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {UNIT_BASES.find((u) => u.value === t.unit_basis)?.label}
                  {t.is_active ? "" : " · inactive"}
                </span>
              </button>
              {openId === t.id && (
                <TemplateForm template={t} canEdit={canEdit} reload={() => list.refetch()} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplateForm({
  template,
  canEdit,
  reload,
}: {
  template: ComponentTemplate;
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    internal_name: template.internal_name,
    customer_name: template.customer_name ?? "",
    customer_description: template.customer_description ?? "",
    unit_basis: template.unit_basis as string,
    internal_cost: String(template.internal_cost ?? "0"),
    customer_price: String(template.customer_price ?? "0"),
    min_quantity: String(template.min_quantity ?? "0"),
    max_quantity: template.max_quantity == null ? "" : String(template.max_quantity),
    default_quantity: template.default_quantity == null ? "" : String(template.default_quantity),
    season_eligible: template.season_eligible,
    promo_eligible: template.promo_eligible,
    is_active: template.is_active,
  });

  async function save() {
    const { error } = await supabase
      .from("component_templates")
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
      })
      .eq("id", template.id);
    if (error) return toast.error(error.message);
    await recordAdminAction("component_template_updated", "component_templates", draft.internal_name);
    toast.success("Template saved.");
    reload();
  }

  async function remove() {
    const { error } = await supabase.from("component_templates").delete().eq("id", template.id);
    if (error) return toast.error(error.message);
    await recordAdminAction("component_template_deleted", "component_templates", template.internal_name);
    toast.success("Template deleted. Components already copied are unaffected.");
    reload();
  }

  return (
    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <div>
        <Label className="text-xs">Internal name</Label>
        <Input
          value={draft.internal_name}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Customer-facing name</Label>
        <Input
          value={draft.customer_name}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, customer_name: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Customer-facing description</Label>
        <Textarea
          rows={2}
          value={draft.customer_description}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, customer_description: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Unit basis</Label>
        <select
          className={selectClass}
          value={draft.unit_basis}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, unit_basis: e.target.value })}
        >
          {UNIT_BASES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs">Internal cost (IDR)</Label>
        <Input
          inputMode="decimal"
          value={draft.internal_cost}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, internal_cost: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Customer price (IDR)</Label>
        <Input
          inputMode="decimal"
          value={draft.customer_price}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, customer_price: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Minimum quantity</Label>
        <Input
          inputMode="decimal"
          value={draft.min_quantity}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, min_quantity: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Maximum quantity</Label>
        <Input
          inputMode="decimal"
          value={draft.max_quantity}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, max_quantity: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Default quantity</Label>
        <Input
          inputMode="decimal"
          value={draft.default_quantity}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, default_quantity: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.season_eligible}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, season_eligible: v })}
          />
          Season eligible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.promo_eligible}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, promo_eligible: v })}
          />
          Promo eligible
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={draft.is_active}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
          />
          Active
        </label>
      </div>
      {canEdit && (
        <div className="flex gap-2 sm:col-span-2">
          <Button size="sm" onClick={save}>
            Save template
          </Button>
          <Button size="sm" variant="ghost" onClick={remove}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

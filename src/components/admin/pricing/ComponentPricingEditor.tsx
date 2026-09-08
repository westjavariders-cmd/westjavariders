import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import { NUMERIC_FIELD_TYPES, PRICING_CONDITION_OPERATORS } from "@/lib/pricing";
import type { PricingRule } from "@/lib/pricing";
import type { ProductBundle } from "@/lib/catalog";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

const BASIS_LABEL: Record<string, string> = {
  fixed: "fixed (one unit)",
  per_person: "per person",
  per_day: "per day",
  per_night: "per night",
  per_session: "per session",
};

/**
 * One component pricing entry: which component of this product is charged, how
 * its quantity is taken from the configurator, and an optional condition.
 * The component itself stays the only source of its customer price.
 */
export function ComponentPricingEditor({
  bundle,
  rule,
  canEdit,
  reload,
}: {
  bundle: ProductBundle;
  rule: PricingRule;
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    label: rule.label,
    component_id: rule.component_id ?? "",
    quantity_variable: rule.quantity_variable ?? "",
    condition_variable: rule.condition_variable ?? "",
    condition_operator: rule.condition_operator ?? "equals",
    condition_value: rule.condition_value ?? "",
    display_order: String(rule.display_order),
    is_active: rule.is_active,
  });

  const numericFields = bundle.fields.filter(
    (f) => f.is_active && NUMERIC_FIELD_TYPES.includes(f.field_type),
  );
  const allFields = bundle.fields.filter((f) => f.is_active && f.field_type !== "info_block");
  const component = bundle.components.find((c) => c.id === draft.component_id);
  const conditionField = allFields.find((f) => f.variable_name === draft.condition_variable);
  const conditionOptions = conditionField
    ? bundle.options.filter((o) => o.field_id === conditionField.id && o.is_active)
    : [];

  async function save() {
    const { error } = await supabase
      .from("pricing_rules")
      .update({
        label: draft.label.trim() || component?.internal_name || "Component",
        rule_type: "component_quantity",
        component_id: draft.component_id || null,
        quantity_variable: draft.quantity_variable || null,
        condition_variable: draft.condition_variable || null,
        condition_operator: draft.condition_variable ? draft.condition_operator : null,
        condition_value: draft.condition_variable ? draft.condition_value || null : null,
        amount_idr: null,
        variable_name: null,
        display_order: Number(draft.display_order || 0),
        is_active: draft.is_active,
      })
      .eq("id", rule.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await recordAdminAction("pricing_component_updated", "pricing_rules", rule.id, {
      component_id: draft.component_id,
      quantity_variable: draft.quantity_variable || null,
    });
    toast.success("Component pricing saved.");
    reload();
  }

  async function remove() {
    const { error } = await supabase.from("pricing_rules").delete().eq("id", rule.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await recordAdminAction("pricing_component_deleted", "pricing_rules", rule.id, {});
    reload();
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label className="text-[11px]">Component (this product only)</Label>
            <select
              className={selectClass}
              value={draft.component_id}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, component_id: e.target.value })}
            >
              <option value="">Choose…</option>
              {bundle.components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.internal_name} — {BASIS_LABEL[c.unit_basis] ?? c.unit_basis} — Rp {c.customer_price}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Name on the breakdown</Label>
            <Input
              className="h-8 text-xs"
              value={draft.label}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-[11px]">Order</Label>
            <Input
              className="h-8 w-16 text-xs"
              value={draft.display_order}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, display_order: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label className="text-[11px]">Quantity comes from</Label>
            <select
              className={selectClass}
              value={draft.quantity_variable}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, quantity_variable: e.target.value })}
            >
              <option value="">
                {component
                  ? `Its basis — ${BASIS_LABEL[component.unit_basis] ?? component.unit_basis}`
                  : "Its own basis"}
              </option>
              {numericFields.map((f) => (
                <option key={f.id} value={f.variable_name}>
                  {f.internal_name} ({f.variable_name})
                </option>
              ))}
            </select>
          </div>
          {component && (
            <div className="text-[11px] text-muted-foreground sm:col-span-2 sm:pt-5">
              Customer price Rp {component.customer_price} × quantity. Internal cost Rp{" "}
              {component.internal_cost} (never shown to customers).
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <Label className="text-[11px]">Charge only when (optional)</Label>
            <select
              className={selectClass}
              value={draft.condition_variable}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, condition_variable: e.target.value })}
            >
              <option value="">Always charged</option>
              {allFields.map((f) => (
                <option key={f.id} value={f.variable_name}>
                  {f.internal_name} ({f.variable_name})
                </option>
              ))}
            </select>
          </div>
          {draft.condition_variable && (
            <>
              <div>
                <Label className="text-[11px]">Condition</Label>
                <select
                  className={selectClass}
                  value={draft.condition_operator}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, condition_operator: e.target.value })}
                >
                  {PRICING_CONDITION_OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {conditionField?.field_type === "multi_select" && o.value === "equals"
                        ? "includes"
                        : conditionField?.field_type === "multi_select" && o.value === "not_equals"
                          ? "does not include"
                          : o.label}
                    </option>
                  ))}
                </select>
              </div>
              {!["is_true", "is_false"].includes(draft.condition_operator) && (
                <div>
                  <Label className="text-[11px]">Value</Label>
                  {conditionOptions.length > 0 ? (
                    <select
                      className={selectClass}
                      value={draft.condition_value}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...draft, condition_value: e.target.value })}
                    >
                      <option value="">Choose…</option>
                      {conditionOptions.map((o) => (
                        <option key={o.id} value={o.internal_value}>
                          {o.customer_label || o.internal_value} ({o.internal_value})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="h-8 text-xs"
                      value={draft.condition_value}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...draft, condition_value: e.target.value })}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px]">
            <Switch
              checked={draft.is_active}
              disabled={!canEdit}
              onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
            />
            Active
          </label>
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={save}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={remove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

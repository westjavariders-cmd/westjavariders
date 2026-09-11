import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import { NUMERIC_FIELD_TYPES, PRICING_CONDITION_OPERATORS, PRICING_RULE_TYPES } from "@/lib/pricing";
import type { PricingRule, PricingTier } from "@/lib/pricing";
import type { ProductBundle } from "@/lib/catalog";
import { selectClass } from "@/components/admin/configurator/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

/** One structured pricing rule, with the inputs its type actually needs. */
export function RuleEditor({
  bundle,
  rule,
  tiers,
  canEdit,
  reload,
}: {
  bundle: ProductBundle;
  rule: PricingRule;
  tiers: PricingTier[];
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    label: rule.label,
    rule_type: rule.rule_type as string,
    amount_idr: rule.amount_idr == null ? "" : String(rule.amount_idr),
    variable_name: rule.variable_name ?? "",
    quantity_variable: rule.quantity_variable ?? "",
    component_id: rule.component_id ?? "",
    condition_variable: rule.condition_variable ?? "",
    condition_operator: rule.condition_operator ?? "equals",
    condition_value: rule.condition_value ?? "",
    sign: rule.sign as string,
    display_order: String(rule.display_order),
    is_active: rule.is_active,
  });
  const [newTier, setNewTier] = useState({ from_value: "", to_value: "", amount_idr: "" });

  const numericFields = bundle.fields.filter(
    (f) => f.is_active && NUMERIC_FIELD_TYPES.includes(f.field_type),
  );
  const allFields = bundle.fields.filter((f) => f.is_active && f.field_type !== "info_block");

  async function save() {
    const { error } = await supabase
      .from("pricing_rules")
      .update({
        label: draft.label.trim(),
        rule_type: draft.rule_type as PricingRule["rule_type"],
        amount_idr: draft.amount_idr === "" ? null : Number(draft.amount_idr),
        variable_name: draft.variable_name || null,
        quantity_variable: draft.quantity_variable || null,
        component_id: draft.component_id || null,
        condition_variable: draft.condition_variable || null,
        condition_operator: draft.condition_operator || null,
        condition_value: draft.condition_value || null,
        sign: draft.sign as PricingRule["sign"],
        display_order: Number(draft.display_order || 0),
        is_active: draft.is_active,
      })
      .eq("id", rule.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await recordAdminAction("pricing_rule_updated", "pricing_rules", rule.id, { label: draft.label });
    toast.success("Rule saved.");
    reload();
  }

  async function remove() {
    const { error } = await supabase.from("pricing_rules").delete().eq("id", rule.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await recordAdminAction("pricing_rule_deleted", "pricing_rules", rule.id, {});
    reload();
  }

  async function addTier() {
    const { error } = await supabase.from("pricing_tiers").insert({
      rule_id: rule.id,
      from_value: Number(newTier.from_value || 0),
      to_value: newTier.to_value === "" ? null : Number(newTier.to_value),
      amount_idr: Number(newTier.amount_idr || 0),
      display_order: tiers.length,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewTier({ from_value: "", to_value: "", amount_idr: "" });
    reload();
  }

  async function removeTier(id: string) {
    const { error } = await supabase.from("pricing_tiers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    reload();
  }

  const type = draft.rule_type;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label className="text-[11px]">Name</Label>
            <Input
              className="h-8 text-xs"
              value={draft.label}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-[11px]">Type</Label>
            <select
              className={selectClass}
              value={type}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, rule_type: e.target.value })}
            >
              {PRICING_RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">Effect</Label>
            <select
              className={selectClass}
              value={draft.sign}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, sign: e.target.value })}
            >
              <option value="add">Adds</option>
              <option value="subtract">Subtracts</option>
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {["fixed", "variable_times_amount", "conditional"].includes(type) && (
            <div>
              <Label className="text-[11px]">Amount (Rp)</Label>
              <Input
                className="h-8 text-xs"
                value={draft.amount_idr}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, amount_idr: e.target.value })}
              />
            </div>
          )}

          {["variable_times_amount", "tier"].includes(type) && (
            <div>
              <Label className="text-[11px]">Number question</Label>
              <select
                className={selectClass}
                value={draft.variable_name}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, variable_name: e.target.value })}
              >
                <option value="">Choose…</option>
                {numericFields.map((f) => (
                  <option key={f.id} value={f.variable_name}>
                    {f.internal_name} ({f.variable_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "tier" && (
            <div>
              <Label className="text-[11px]">Multiply tier by (optional)</Label>
              <select
                className={selectClass}
                value={draft.quantity_variable}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, quantity_variable: e.target.value })}
              >
                <option value="">No multiplier</option>
                {numericFields
                  .filter((f) => f.variable_name !== draft.variable_name)
                  .map((f) => (
                    <option key={f.id} value={f.variable_name}>
                      {f.internal_name} ({f.variable_name})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {type === "component_quantity" && (
            <div className="sm:col-span-2">
              <Label className="text-[11px]">Component</Label>
              <select
                className={selectClass}
                value={draft.component_id}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, component_id: e.target.value })}
              >
                <option value="">Choose…</option>
                {bundle.components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.internal_name} — {c.unit_basis.replace("_", " ")} — Rp {c.customer_price}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "conditional" && (
            <>
              <div>
                <Label className="text-[11px]">When question</Label>
                <select
                  className={selectClass}
                  value={draft.condition_variable}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, condition_variable: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {allFields.map((f) => (
                    <option key={f.id} value={f.variable_name}>
                      {f.internal_name} ({f.variable_name})
                    </option>
                  ))}
                </select>
              </div>
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
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {!["is_true", "is_false"].includes(draft.condition_operator) && (
                <div>
                  <Label className="text-[11px]">Value</Label>
                  <Input
                    className="h-8 text-xs"
                    value={draft.condition_value}
                    disabled={!canEdit}
                    onChange={(e) => setDraft({ ...draft, condition_value: e.target.value })}
                  />
                </div>
              )}
            </>
          )}

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

        {type === "tier" && (
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            <p className="text-[11px] font-medium">
              Tiers — each amount is the total for that range (not per person). With a multiplier
              selected, it becomes the rate that is multiplied by that question.
            </p>
            {tiers.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono">
                  {t.from_value}–{t.to_value ?? "∞"}
                </span>
                <span>Rp {t.amount_idr}</span>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => removeTier(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-[11px]">From</Label>
                  <Input
                    className="h-8 w-20 text-xs"
                    value={newTier.from_value}
                    onChange={(e) => setNewTier({ ...newTier, from_value: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">To (blank = no limit)</Label>
                  <Input
                    className="h-8 w-24 text-xs"
                    value={newTier.to_value}
                    onChange={(e) => setNewTier({ ...newTier, to_value: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Total (Rp)</Label>
                  <Input
                    className="h-8 w-28 text-xs"
                    value={newTier.amount_idr}
                    onChange={(e) => setNewTier({ ...newTier, amount_idr: e.target.value })}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={addTier}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add tier
                </Button>
              </div>
            )}
          </div>
        )}

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
                Save rule
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

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  DEPENDENCY_ACTIONS,
  OPERATORS,
  type ProductBundle,
} from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { selectClass } from "./ui";

type Props = { bundle: ProductBundle; canEdit: boolean; reload: () => void };

type Draft = {
  source_field_id: string;
  source_option_id: string;
  operator: string;
  compare_value: string;
  action: string;
  action_value: string;
  target: string; // "field:<id>" or "option:<id>"
  is_active: boolean;
};

const emptyDraft: Draft = {
  source_field_id: "",
  source_option_id: "",
  operator: "equals",
  compare_value: "",
  action: "show",
  action_value: "",
  target: "",
  is_active: true,
};

export function DependenciesTab({ bundle, canEdit, reload }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const fieldById = useMemo(
    () => new Map(bundle.fields.map((f) => [f.id, f])),
    [bundle.fields],
  );
  const optionById = useMemo(
    () => new Map(bundle.options.map((o) => [o.id, o])),
    [bundle.options],
  );

  const operator = OPERATORS.find((o) => o.value === draft.operator);
  const action = DEPENDENCY_ACTIONS.find((a) => a.value === draft.action);
  const sourceOptions = bundle.options.filter((o) => o.field_id === draft.source_field_id);

  async function add() {
    if (!draft.source_field_id) { toast.error("Choose the field the rule watches."); return; }
    if (!draft.target) { toast.error("Choose what the rule affects."); return; }
    if (operator?.needsValue && !draft.compare_value.trim() && !draft.source_option_id) {
      { toast.error("This condition needs a value."); return; }
    }
    if (action?.needsValue && !draft.action_value.trim()) {
      { toast.error("This action needs a value."); return; }
    }
    const [kind, id] = draft.target.split(":");
    // Targets come from this product only, so a rule can never reach another product.
    if (kind === "field" && !fieldById.has(id ?? "")) { toast.error("Invalid target."); return; }
    if (kind === "option" && !optionById.has(id ?? "")) { toast.error("Invalid target."); return; }

    setSaving(true);
    const { error } = await supabase.from("dependencies").insert({
      product_id: bundle.product.id,
      source_field_id: draft.source_field_id,
      source_option_id: draft.source_option_id || null,
      operator: draft.operator,
      compare_value: draft.compare_value.trim() || null,
      action: draft.action as never,
      action_value: draft.action_value.trim() || null,
      target_field_id: kind === "field" ? (id ?? null) : null,
      target_option_id: kind === "option" ? (id ?? null) : null,
      is_active: draft.is_active,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("dependency_added", "dependencies", bundle.product.internal_name);
    toast.success("Rule added.");
    setDraft(emptyDraft);
    reload();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("dependencies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("dependency_removed", "dependencies", bundle.product.internal_name);
    reload();
  }

  async function toggle(id: string, is_active: boolean) {
    const { error } = await supabase.from("dependencies").update({ is_active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    reload();
  }

  function describe(id: string) {
    const d = bundle.dependencies.find((x) => x.id === id)!;
    const src = fieldById.get(d.source_field_id);
    const op = OPERATORS.find((o) => o.value === d.operator);
    const act = DEPENDENCY_ACTIONS.find((a) => a.value === d.action);
    const targetName = d.target_field_id
      ? fieldById.get(d.target_field_id)?.internal_name
      : `option "${optionById.get(d.target_option_id ?? "")?.internal_value ?? "?"}"`;
    const value =
      d.compare_value ??
      (d.source_option_id ? optionById.get(d.source_option_id)?.internal_value : "");
    return `When ${src?.internal_name ?? "?"} ${op?.label ?? d.operator} ${
      op?.needsValue ? `"${value ?? ""}"` : ""
    } → ${act?.label ?? d.action}${d.action_value ? ` "${d.action_value}"` : ""} on ${targetName ?? "?"}`;
  }

  return (
    <div className="space-y-4">
      {bundle.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">Add configurator fields first.</p>
      )}

      {canEdit && bundle.fields.length > 0 && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">When this field</Label>
              <select
                className={selectClass}
                value={draft.source_field_id}
                onChange={(e) =>
                  setDraft({ ...draft, source_field_id: e.target.value, source_option_id: "" })
                }
              >
                <option value="">Choose a field…</option>
                {bundle.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.internal_name} ({f.variable_name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Condition</Label>
              <select
                className={selectClass}
                value={draft.operator}
                onChange={(e) => setDraft({ ...draft, operator: e.target.value })}
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {operator?.needsValue && (
              <>
                {sourceOptions.length > 0 && (
                  <div>
                    <Label className="text-xs">Option (optional shortcut)</Label>
                    <select
                      className={selectClass}
                      value={draft.source_option_id}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          source_option_id: e.target.value,
                          compare_value:
                            sourceOptions.find((o) => o.id === e.target.value)?.internal_value ?? "",
                        })
                      }
                    >
                      <option value="">Type a value instead</option>
                      {sourceOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.customer_label ?? o.internal_value}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input
                    value={draft.compare_value}
                    onChange={(e) => setDraft({ ...draft, compare_value: e.target.value })}
                  />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Then</Label>
              <select
                className={selectClass}
                value={draft.action}
                onChange={(e) => setDraft({ ...draft, action: e.target.value, action_value: "" })}
              >
                {DEPENDENCY_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">On</Label>
              <select
                className={selectClass}
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              >
                <option value="">Choose a target…</option>
                {bundle.fields.map((f) => (
                  <option key={f.id} value={`field:${f.id}`}>
                    Field · {f.internal_name}
                  </option>
                ))}
                {bundle.options.map((o) => (
                  <option key={o.id} value={`option:${o.id}`}>
                    Option · {fieldById.get(o.field_id)?.internal_name} / {o.internal_value}
                  </option>
                ))}
              </select>
            </div>
            {action?.needsValue && (
              <div>
                <Label className="text-xs">{action.label} value</Label>
                <Input
                  value={draft.action_value}
                  onChange={(e) => setDraft({ ...draft, action_value: e.target.value })}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <Button size="sm" onClick={add} disabled={saving}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {bundle.dependencies.length === 0 && (
          <p className="text-sm text-muted-foreground">No rules yet.</p>
        )}
        {bundle.dependencies.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
          >
            <span>{describe(d.id)}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <Switch
                  checked={d.is_active}
                  disabled={!canEdit}
                  onCheckedChange={(v) => toggle(d.id, v)}
                />
                Active
              </label>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => remove(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

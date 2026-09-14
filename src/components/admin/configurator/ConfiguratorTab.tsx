import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { linkedComponentIds } from "@/lib/option-components";
import { linkOptionComponent, unlinkOptionComponent } from "@/lib/pricing.functions";
import { recordAdminAction } from "@/lib/admin-audit";
import {
  FIELD_TYPES,
  SELECT_FIELD_TYPES,
  type Field,
  type FieldOption,
  type ProductBundle,
  type Step,
} from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { selectClass } from "./ui";
import { CATALOGUE_TYPES, type CatalogueType } from "@/lib/catalogue-bridge";
import {
  CATALOGUE_TEMPLATE_SHORT,
  CATALOGUE_TYPE_OF_TEMPLATE,
  catalogueLabel,
  type CatalogueTemplate,
} from "@/lib/catalogues";

const CATALOGUE_TYPE_LABELS: Record<CatalogueType, string> = {
  accommodation_room: "Every accommodation catalogue",
  transport: "Every transport catalogue",
  motorbike: "Every simple-item catalogue",
};

/** Active catalogues a question can read from. */
function useCatalogueChoices() {
  return useQuery({
    queryKey: ["active-catalogues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("id, internal_name, public_name, template, active")
        .eq("active", true)
        .order("sort_order")
        .order("internal_name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

type Props = { bundle: ProductBundle; canEdit: boolean; reload: () => void };

const numeric = (v: string) => (v.trim() === "" ? null : Number(v));

export function ConfiguratorTab({ bundle, canEdit, reload }: Props) {
  const [openStep, setOpenStep] = useState<string | null>(bundle.steps[0]?.id ?? null);

  async function addStep() {
    if (!bundle.flow) { toast.error("This product has no configurator flow yet."); return; }
    const { error } = await supabase.from("steps").insert({
      flow_id: bundle.flow.id,
      internal_name: `Step ${bundle.steps.length + 1}`,
      display_order: bundle.steps.length,
    });
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("configurator_step_added", "steps", bundle.product.internal_name);
    reload();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Button size="sm" variant="outline" onClick={addStep}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add step
        </Button>
      )}
      {bundle.steps.length === 0 && (
        <p className="text-sm text-muted-foreground">No steps yet.</p>
      )}
      {bundle.steps.map((step) => (
        <Card key={step.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-left text-sm font-medium"
                onClick={() => setOpenStep(openStep === step.id ? null : step.id)}
              >
                {step.internal_name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {bundle.fields.filter((f) => f.step_id === step.id).length} field(s)
                  {step.is_active ? "" : " · inactive"}
                </span>
              </button>
            </div>
            {openStep === step.id && (
              <StepEditor bundle={bundle} step={step} canEdit={canEdit} reload={reload} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StepEditor({
  bundle,
  step,
  canEdit,
  reload,
}: Props & { step: Step }) {
  const [draft, setDraft] = useState({
    internal_name: step.internal_name,
    customer_title: step.customer_title ?? "",
    customer_description: step.customer_description ?? "",
    display_order: String(step.display_order),
    is_active: step.is_active,
  });
  const [openField, setOpenField] = useState<string | null>(null);
  const fields = bundle.fields.filter((f) => f.step_id === step.id);

  async function save() {
    const { error } = await supabase
      .from("steps")
      .update({
        internal_name: draft.internal_name.trim(),
        customer_title: draft.customer_title.trim() || null,
        customer_description: draft.customer_description.trim() || null,
        display_order: Number(draft.display_order || 0),
        is_active: draft.is_active,
      })
      .eq("id", step.id);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("configurator_step_updated", "steps", draft.internal_name);
    toast.success("Step saved.");
    reload();
  }

  async function removeStep() {
    const { error } = await supabase.from("steps").delete().eq("id", step.id);
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("configurator_step_removed", "steps", step.internal_name);
    toast.success("Step removed.");
    reload();
  }

  async function addField() {
    const n = bundle.fields.length + 1;
    const { error } = await supabase.from("fields").insert({
      product_id: bundle.product.id,
      step_id: step.id,
      internal_name: `Field ${n}`,
      variable_name: `field_${n}`,
      field_type: "text",
      display_order: fields.length,
    });
    if (error) { toast.error(error.message); return; }
    await recordAdminAction("configurator_field_added", "fields", bundle.product.internal_name);
    reload();
  }

  return (
    <div className="space-y-4 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Internal name</Label>
          <Input
            value={draft.internal_name}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Customer-facing title</Label>
          <Input
            value={draft.customer_title}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, customer_title: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea
            rows={2}
            value={draft.customer_description}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, customer_description: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Display order</Label>
          <Input
            value={draft.display_order}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, display_order: e.target.value })}
          />
        </div>
        <label className="flex items-end gap-2 pb-1 text-sm">
          <Switch
            checked={draft.is_active}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
          />
          Active
        </label>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            Save step
          </Button>
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add field
          </Button>
          <Button size="sm" variant="ghost" onClick={removeStep}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete step
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id} className="rounded-md border border-border p-3">
            <button
              type="button"
              className="text-left text-sm font-medium"
              onClick={() => setOpenField(openField === field.id ? null : field.id)}
            >
              {field.internal_name}
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {field.variable_name}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {FIELD_TYPES.find((t) => t.value === field.field_type)?.label}
                {field.is_active ? "" : " · inactive"}
              </span>
            </button>
            {openField === field.id && (
              <FieldEditor bundle={bundle} field={field} canEdit={canEdit} reload={reload} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldEditor({
  bundle,
  field,
  canEdit,
  reload,
}: Props & { field: Field }) {
  const [draft, setDraft] = useState({
    internal_name: field.internal_name,
    variable_name: field.variable_name,
    customer_label: field.customer_label ?? "",
    help_text: field.help_text ?? "",
    field_type: field.field_type as string,
    is_required: field.is_required,
    is_active: field.is_active,
    default_value: field.default_value ?? "",
    min_value: field.min_value == null ? "" : String(field.min_value),
    max_value: field.max_value == null ? "" : String(field.max_value),
    display_order: String(field.display_order),
    option_source: ((field as any).option_source as string) || "manual",
    catalogue_type: ((field as any).catalogue_type as string) || "",
    catalogue_id: ((field as any).catalogue_id as string | null) ?? "",
  });
  const catalogues = useCatalogueChoices();
  const options = bundle.options.filter((o) => o.field_id === field.id);
  const isSelect = SELECT_FIELD_TYPES.includes(draft.field_type);
  const usesCatalogue = isSelect && draft.option_source === "catalogue";

  async function save() {
    if (usesCatalogue && !CATALOGUE_TYPES.includes(draft.catalogue_type as never)) {
      { toast.error("Choose which catalogue this question reads."); return; }
    }
    if (!/^[a-z][a-z0-9_]*$/.test(draft.variable_name)) {
      { toast.error("Variable name must be lowercase letters, numbers and underscores."); return; }
    }
    if (draft.variable_name !== field.variable_name) {
      const duplicate = bundle.fields.some(
        (f) => f.id !== field.id && f.variable_name === draft.variable_name,
      );
      if (duplicate) { toast.error("This variable name is already used in this product."); return; }
    }
    const { error } = await supabase
      .from("fields")
      .update({
        internal_name: draft.internal_name.trim(),
        variable_name: draft.variable_name.trim(),
        customer_label: draft.customer_label.trim() || null,
        help_text: draft.help_text.trim() || null,
        field_type: draft.field_type as never,
        is_required: draft.is_required,
        is_active: draft.is_active,
        default_value: draft.default_value.trim() || null,
        min_value: numeric(draft.min_value),
        max_value: numeric(draft.max_value),
        display_order: Number(draft.display_order || 0),
        option_source: usesCatalogue ? "catalogue" : "manual",
        catalogue_type: usesCatalogue ? (draft.catalogue_type as never) : null,
        catalogue_id: usesCatalogue && draft.catalogue_id ? draft.catalogue_id : null,
      })
      .eq("id", field.id);
    if (error) { toast.error(error.message); return; }
    // A rename must follow through to Pricing, otherwise its quantity mappings
    // and rules keep pointing at a name that no longer exists.
    const renamedFrom = draft.variable_name === field.variable_name ? null : field.variable_name;
    if (renamedFrom) {
      const { error: syncError } = await supabase.rpc("rename_pricing_variable", {
        _product_id: bundle.product.id,
        _old: renamedFrom,
        _new: draft.variable_name.trim(),
      });
      if (syncError) {
        toast.error("The question was renamed, but Pricing could not be updated. Check Pricing settings.");
      }
    }
    await recordAdminAction("configurator_field_updated", "fields", draft.internal_name, {
      variable_name: draft.variable_name,
      renamed_from: renamedFrom,
    });
    toast.success("Field saved.");
    reload();
  }

  async function removeField() {
    const { error } = await supabase.from("fields").delete().eq("id", field.id);
    if (error) { toast.error(error.message); return; }
    // Clear any Pricing mapping that used this question, so activation is never
    // blocked by a pointer to a deleted question.
    await supabase.rpc("clear_pricing_variable", {
      _product_id: bundle.product.id,
      _name: field.variable_name,
    });
    await recordAdminAction("configurator_field_removed", "fields", field.internal_name);
    reload();
  }


  async function addOption() {
    const { error } = await supabase.from("field_options").insert({
      field_id: field.id,
      internal_value: `option_${options.length + 1}`,
      customer_label: `Option ${options.length + 1}`,
      display_order: options.length,
    });
    if (error) { toast.error(error.message); return; }
    reload();
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Internal name</Label>
          <Input
            value={draft.internal_name}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, internal_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Variable name (used by future pricing)</Label>
          <Input
            className="font-mono"
            value={draft.variable_name}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, variable_name: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Change with care: future pricing formulas will reference this name.
          </p>
        </div>
        <div>
          <Label className="text-xs">Customer-facing label</Label>
          <Input
            value={draft.customer_label}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, customer_label: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Field type</Label>
          <select
            className={selectClass}
            value={draft.field_type}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, field_type: e.target.value })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {isSelect && (
          <>
            <div>
              <Label className="text-xs">Where the choices come from</Label>
              <select
                className={selectClass}
                value={draft.option_source}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, option_source: e.target.value })}
              >
                <option value="manual">Options I enter here</option>
                <option value="catalogue">A catalogue</option>
              </select>
            </div>
            {draft.option_source === "catalogue" && (
              <div>
                <Label className="text-xs">Catalogue</Label>
                <select
                  className={selectClass}
                  value={draft.catalogue_id ? `id:${draft.catalogue_id}` : draft.catalogue_type ? `type:${draft.catalogue_type}` : ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw.startsWith("id:")) {
                      const id = raw.slice(3);
                      const chosen = (catalogues.data ?? []).find((c) => c.id === id);
                      setDraft({
                        ...draft,
                        catalogue_id: id,
                        catalogue_type: chosen
                          ? CATALOGUE_TYPE_OF_TEMPLATE[chosen.template as CatalogueTemplate]
                          : "",
                      });
                    } else if (raw.startsWith("type:")) {
                      setDraft({ ...draft, catalogue_id: "", catalogue_type: raw.slice(5) });
                    } else {
                      setDraft({ ...draft, catalogue_id: "", catalogue_type: "" });
                    }
                  }}
                >
                  <option value="">Choose a catalogue…</option>
                  {(catalogues.data ?? []).map((c) => (
                    <option key={c.id} value={`id:${c.id}`}>
                      {catalogueLabel(c as never)} ({CATALOGUE_TEMPLATE_SHORT[c.template as CatalogueTemplate]})
                    </option>
                  ))}
                  {CATALOGUE_TYPES.map((t) => (
                    <option key={t} value={`type:${t}`}>
                      {CATALOGUE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Customers see the active items of this catalogue. The price of the chosen item is
                  available to pricing as{" "}
                  <span className="font-mono">{draft.variable_name}_price</span>.
                </p>
              </div>
            )}
          </>
        )}
        <div className="sm:col-span-2">
          <Label className="text-xs">Help text</Label>
          <Textarea
            rows={2}
            value={draft.help_text}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, help_text: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Default value</Label>
          <Input
            value={draft.default_value}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, default_value: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Display order</Label>
          <Input
            value={draft.display_order}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, display_order: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Minimum value</Label>
          <Input
            inputMode="decimal"
            value={draft.min_value}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, min_value: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Maximum value</Label>
          <Input
            inputMode="decimal"
            value={draft.max_value}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, max_value: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.is_required}
              disabled={!canEdit}
              onCheckedChange={(v) => setDraft({ ...draft, is_required: v })}
            />
            Required
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
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save}>
            Save field
          </Button>
          {isSelect && !usesCatalogue && (
            <Button size="sm" variant="outline" onClick={addOption}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add option
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={removeField}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete field
          </Button>
        </div>
      )}

      {isSelect && (
        <div className="space-y-2">
          {options.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              field={field}
              bundle={bundle}
              canEdit={canEdit}
              reload={reload}
            />
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">This select field has no option yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  option,
  field,
  bundle,
  canEdit,
  reload,
}: {
  option: FieldOption;
  field: Field;
  bundle: ProductBundle;
  canEdit: boolean;
  reload: () => void;
}) {
  const [draft, setDraft] = useState({
    internal_value: option.internal_value,
    customer_label: option.customer_label ?? "",
    description: option.description ?? "",
    display_order: String(option.display_order),
    is_active: option.is_active,
    is_default: option.is_default,
  });

  async function save() {
    const { error } = await supabase
      .from("field_options")
      .update({
        internal_value: draft.internal_value.trim(),
        customer_label: draft.customer_label.trim() || null,
        description: draft.description.trim() || null,
        display_order: Number(draft.display_order || 0),
        is_active: draft.is_active,
        is_default: draft.is_default,
      })
      .eq("id", option.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Option saved.");
    reload();
  }

  async function remove() {
    const { error } = await supabase.from("field_options").delete().eq("id", option.id);
    if (error) { toast.error(error.message); return; }
    reload();
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2">
    <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]">
      <div>
        <Label className="text-[11px]">Internal value</Label>
        <Input
          className="h-8 font-mono text-xs"
          value={draft.internal_value}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, internal_value: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-[11px]">Customer label</Label>
        <Input
          className="h-8 text-xs"
          value={draft.customer_label}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, customer_label: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-[11px]">Order</Label>
        <Input
          className="h-8 text-xs"
          value={draft.display_order}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, display_order: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[11px]">
          <Switch
            checked={draft.is_active}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
          />
          Active
        </label>
        <label className="flex items-center gap-1 text-[11px]">
          <Switch
            checked={draft.is_default}
            disabled={!canEdit}
            onCheckedChange={(v) => setDraft({ ...draft, is_default: v })}
          />
          Default
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
    </div>
      <OptionComponents option={option} field={field} bundle={bundle} canEdit={canEdit} />
    </div>
  );
}

/**
 * Components charged when this option is selected. Each link is the existing
 * structured component pricing rule; the question variable and the option value
 * are derived here, never typed by the Admin.
 */
function OptionComponents({
  option,
  field,
  bundle,
  canEdit,
}: {
  option: FieldOption;
  field: Field;
  bundle: ProductBundle;
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState("");
  const link = useServerFn(linkOptionComponent);
  const unlink = useServerFn(unlinkOptionComponent);

  const rulesQuery = useQuery({
    queryKey: ["option-component-rules", bundle.product.id],
    queryFn: async () => {
      const { data: pricing } = await supabase
        .from("product_pricing")
        .select("id")
        .eq("product_id", bundle.product.id)
        .maybeSingle();
      if (!pricing) return [];
      const { data } = await supabase
        .from("pricing_rules")
        .select("*")
        .eq("pricing_id", pricing.id)
        .order("display_order");
      return data ?? [];
    },
  });

  const linkedIds = linkedComponentIds(
    (rulesQuery.data ?? []) as never,
    field.variable_name,
    option.internal_value,
  );
  const linked = bundle.components.filter((c) => linkedIds.includes(c.id));
  const available = bundle.components.filter((c) => !linkedIds.includes(c.id));

  return (
    <div className="space-y-1 border-t border-border pt-2">
      <Label className="text-[11px]">Components charged when this option is chosen</Label>
      {linked.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No component linked yet.</p>
      )}
      {linked.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-xs">
          <span>{c.internal_name}</span>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await unlink({ data: { optionId: option.id, componentId: c.id } });
                  toast.success("Component unlinked.");
                  void rulesQuery.refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "This link could not be removed.");
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {canEdit && available.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select
            className={selectClass}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
          >
            <option value="">Add a component…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.internal_name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!adding}
            onClick={async () => {
              try {
                await link({ data: { optionId: option.id, componentId: adding } });
                setAdding("");
                toast.success("Component linked.");
                void rulesQuery.refetch();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "This link could not be created.");
              }
            }}
          >
            Link
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        The component keeps its own price and quantity settings, managed on the Pricing tab.
      </p>
    </div>
  );
}

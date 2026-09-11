import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  evaluateDependencies,
  type Field,
  type PreviewValues,
  type ProductBundle,
} from "@/lib/catalog";
import {
  fieldCatalogueType,
  itemsForField,
  type CatalogueItem,
  type CatalogueType,
} from "@/lib/catalogue-bridge";

import { previewCatalogue } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


/**
 * Renders the product's real saved configuration so the administrator can
 * test it. No pricing, no currency, no checkout.
 */
export function PreviewTab({ bundle }: { bundle: ProductBundle }) {
  const activeSteps = bundle.steps.filter((s) => s.is_active);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<PreviewValues>(() => {
    const initial: PreviewValues = {};
    for (const f of bundle.fields) {
      if (f.field_type === "multi_select") {
        const defaults = bundle.options
          .filter((o) => o.field_id === f.id && o.is_default && o.is_active)
          .map((o) => o.internal_value);
        initial[f.variable_name] = defaults;
      } else if (f.field_type === "boolean") {
        initial[f.variable_name] = f.default_value === "true";
      } else {
        const defaultOption = bundle.options.find(
          (o) => o.field_id === f.id && o.is_default && o.is_active,
        );
        initial[f.variable_name] = defaultOption?.internal_value ?? f.default_value ?? "";
      }
    }
    return initial;
  });

  const evaluated = useMemo(() => evaluateDependencies(bundle, values), [bundle, values]);

  // Catalogue-backed questions have no manual options: their choices come from
  // the existing Generic Catalogue Bridge resolver, exactly as in public.
  const catalogueTypes = useMemo(
    () =>
      Array.from(
        new Set(
          bundle.fields
            .filter((f) => f.is_active)
            .map((f) => fieldCatalogueType(f as never))
            .filter((t): t is CatalogueType => t != null),
        ),
      ),
    [bundle.fields],
  );
  const { data: catalogue } = useQuery({
    queryKey: ["preview-catalogue", catalogueTypes],
    enabled: catalogueTypes.length > 0,
    queryFn: () => previewCatalogue({ data: { types: catalogueTypes } }),
  });
  const catalogueItems: Partial<Record<CatalogueType, CatalogueItem[]>> = catalogue ?? {};

  const step = activeSteps[Math.min(stepIndex, Math.max(activeSteps.length - 1, 0))];

  if (activeSteps.length === 0 || !step) {
    return <p className="text-sm text-muted-foreground">There is no active step to preview.</p>;
  }

  const stepFields = bundle.fields
    .filter((f) => f.step_id === step.id && f.is_active)
    .filter((f) => !evaluated.fields[f.id]?.hidden);

  function set(f: Field, value: PreviewValues[string]) {
    setValues((v) => ({ ...v, [f.variable_name]: value }));
  }

  const missing = stepFields.filter((f) => {
    const e = evaluated.fields[f.id];
    if (!e?.required || e.reset || f.field_type === "info_block") return false;
    const v = values[f.variable_name];
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Step {stepIndex + 1} of {activeSteps.length}
        {activeSteps.map((s, i) => (
          <Badge key={s.id} variant={i === stepIndex ? "default" : "secondary"}>
            {s.customer_title || s.internal_name}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <h3 className="text-base font-medium">{step.customer_title || step.internal_name}</h3>
            {step.customer_description && (
              <p className="mt-1 text-sm text-muted-foreground">{step.customer_description}</p>
            )}
          </div>

          {stepFields.length === 0 && (
            <p className="text-sm text-muted-foreground">No visible field in this step.</p>
          )}

          {stepFields.map((f) => {
            const e = evaluated.fields[f.id]!;
            const value = e.forcedValue ?? values[f.variable_name] ?? "";
            const catalogueType = fieldCatalogueType(f as never);
            const options = catalogueType
              ? itemsForField(f as never, catalogueItems).map((item) => ({
                  id: item.id,
                  internal_value: item.id,
                  customer_label: item.name,
                }))

              : bundle.options
                  .filter((o) => o.field_id === f.id && o.is_active)
                  .filter((o) => !evaluated.hiddenOptionIds.has(o.id));


            if (f.field_type === "info_block") {
              return (
                <div key={f.id} className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">{f.customer_label ?? f.internal_name}</p>
                  {f.help_text && <p className="text-muted-foreground">{f.help_text}</p>}
                </div>
              );
            }

            return (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-sm">
                  {f.customer_label ?? f.internal_name}
                  {e.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                {f.help_text && <p className="text-xs text-muted-foreground">{f.help_text}</p>}

                {f.field_type === "single_select" && (
                  <div className="flex flex-wrap gap-2">
                    {options.map((o) => (
                      <Button
                        key={o.id}
                        type="button"
                        size="sm"
                        disabled={e.disabled}
                        variant={value === o.internal_value ? "default" : "outline"}
                        onClick={() =>
                          set(f, value === o.internal_value && !e.required ? "" : o.internal_value)
                        }
                      >
                        {o.customer_label ?? o.internal_value}
                      </Button>
                    ))}
                  </div>
                )}

                {f.field_type === "multi_select" && (
                  <div className="flex flex-wrap gap-2">
                    {options.map((o) => {
                      const list = Array.isArray(values[f.variable_name])
                        ? (values[f.variable_name] as string[])
                        : [];
                      const on = list.includes(o.internal_value);
                      return (
                        <Button
                          key={o.id}
                          type="button"
                          size="sm"
                          disabled={e.disabled}
                          variant={on ? "default" : "outline"}
                          onClick={() =>
                            set(
                              f,
                              on
                                ? list.filter((x) => x !== o.internal_value)
                                : [...list, o.internal_value],
                            )
                          }
                        >
                          {o.customer_label ?? o.internal_value}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {(f.field_type === "quantity" || f.field_type === "number") && (
                  <Input
                    inputMode="decimal"
                    disabled={e.disabled}
                    value={String(value)}
                    min={e.min ?? undefined}
                    max={e.max ?? undefined}
                    onChange={(ev) => set(f, ev.target.value)}
                  />
                )}

                {f.field_type === "text" && (
                  <Input
                    disabled={e.disabled}
                    value={String(value)}
                    onChange={(ev) => set(f, ev.target.value)}
                  />
                )}

                {(f.field_type === "date" || f.field_type === "date_range") && (
                  <Input
                    type="date"
                    disabled={e.disabled}
                    value={String(value)}
                    onChange={(ev) => set(f, ev.target.value)}
                  />
                )}

                {f.field_type === "boolean" && (
                  <Switch
                    checked={values[f.variable_name] === true}
                    disabled={e.disabled}
                    onCheckedChange={(v) => set(f, v)}
                  />
                )}

                {(e.min != null || e.max != null) &&
                  (f.field_type === "quantity" || f.field_type === "number") && (
                    <p className="text-xs text-muted-foreground">
                      {e.min != null && `min ${e.min}`}
                      {e.min != null && e.max != null && " · "}
                      {e.max != null && `max ${e.max}`}
                      {Number(value) !== 0 &&
                        ((e.min != null && Number(value) < e.min) ||
                          (e.max != null && Number(value) > e.max)) && (
                          <span className="ml-2 text-destructive">out of range</span>
                        )}
                    </p>
                  )}
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => i - 1)}
            >
              Back
            </Button>
            <div className="text-xs text-muted-foreground">
              {missing.length > 0 && `${missing.length} required answer(s) missing`}
            </div>
            <Button
              size="sm"
              disabled={stepIndex >= activeSteps.length - 1 || missing.length > 0}
              onClick={() => setStepIndex((i) => i + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Current answers (variable names)</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3">
          {JSON.stringify(values, null, 2)}
        </pre>
      </details>
    </div>
  );
}

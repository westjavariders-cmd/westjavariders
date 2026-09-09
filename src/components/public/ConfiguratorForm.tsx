import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  evaluateDependencies,
  type Field,
  type PreviewValues,
  type ProductBundle,
} from "@/lib/catalog";
import { formatIdr } from "@/lib/public-catalog";
import {
  fieldCatalogueType,
  type CatalogueItem,
  type CatalogueType,
} from "@/lib/catalogue-bridge";
import { completePackage, savePackageConfiguration } from "@/lib/cart.functions";
import { PUBLIC_CART_KEY } from "@/components/public/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";

type Quote = {
  purchasable: boolean;
  configuration_issues: string[];
  errors: string[];
  promo_rejection: string | null;
  subtotal_idr: number;
  season_discount_idr: number;
  promo_discount_idr: number;
  total_idr: number;
};

/** Default answers from the saved Phase 3 configuration (or a recovered draft). */
export function initialValues(bundle: ProductBundle, saved?: PreviewValues | null): PreviewValues {
  const initial: PreviewValues = {};
  for (const f of bundle.fields) {
    if (f.field_type === "multi_select") {
      initial[f.variable_name] = bundle.options
        .filter((o) => o.field_id === f.id && o.is_default && o.is_active)
        .map((o) => o.internal_value);
    } else if (f.field_type === "boolean") {
      initial[f.variable_name] = f.default_value === "true";
    } else {
      const defaultOption = bundle.options.find(
        (o) => o.field_id === f.id && o.is_default && o.is_active,
      );
      initial[f.variable_name] = defaultOption?.internal_value ?? f.default_value ?? "";
    }
  }
  if (saved) {
    for (const [k, v] of Object.entries(saved)) initial[k] = v as never;
  }
  return initial;
}

/**
 * Public configurator. Renders the product's saved flow/steps/fields/options and
 * reuses the existing dependency engine. Every price shown comes from the server.
 */
export function ConfiguratorForm({
  bundle,
  packageId,
  savedAnswers,
  savedPromo,
  catalogue = {},
}: {
  bundle: ProductBundle;
  packageId: string;
  savedAnswers: PreviewValues | null;
  savedPromo: string | null;
  /** Active catalogue items per type, resolved server-side. */
  catalogue?: Partial<Record<CatalogueType, CatalogueItem[]>>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(savePackageConfiguration);
  const complete = useServerFn(completePackage);

  const activeSteps = bundle.steps.filter((s) => s.is_active);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<PreviewValues>(() => initialValues(bundle, savedAnswers));
  const [promo, setPromo] = useState(savedPromo ?? "");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  const seq = useRef(0);

  // Live server quote. Debounced; the newest answer always wins.
  useEffect(() => {
    const id = ++seq.current;
    setQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await save({
          data: {
            packageId,
            answers: values as never,
            month: null,
            promoCode: promo.trim() ? promo.trim() : null,
          },
        });
        if (seq.current === id) setQuote(res.quote as Quote);
      } catch (e) {
        if (seq.current === id) toast.error(e instanceof Error ? e.message : "Price unavailable.");
      } finally {
        if (seq.current === id) setQuoting(false);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, promo, packageId]);

  const evaluated = useMemo(() => evaluateDependencies(bundle, values), [bundle, values]);

  // Applies the saved reset/hide actions to the answers themselves, so a hidden
  // question keeps no value.
  useEffect(() => {
    setValues((v) => {
      const next = stripInactiveAnswers(bundle, v);
      return JSON.stringify(next) === JSON.stringify(v) ? v : next;
    });
  }, [bundle, values]);

  const step = activeSteps[Math.min(stepIndex, Math.max(activeSteps.length - 1, 0))];

  function set(f: Field, value: PreviewValues[string]) {
    setValues((v) => ({ ...v, [f.variable_name]: value }));
  }

  const stepFields = step
    ? bundle.fields
        .filter((f) => f.step_id === step.id && f.is_active)
        .filter((f) => !evaluated.fields[f.id]?.hidden)
    : [];

  const ready =
    !!quote &&
    quote.purchasable &&
    quote.configuration_issues.length === 0 &&
    quote.errors.length === 0;

  async function book() {
    setBooking(true);
    try {
      await complete({ data: { packageId } });
      await queryClient.invalidateQueries({ queryKey: PUBLIC_CART_KEY });
      navigate({ to: "/cart" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This package could not be completed.");
    } finally {
      setBooking(false);
    }
  }

  if (!step) {
    return (
      <p className="text-sm text-muted-foreground">
        This experience is not open for booking right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Step {stepIndex + 1} of {activeSteps.length}
      </p>

      <Card>
        <CardContent className="space-y-5 p-4">
          <div>
            <h2 className="text-lg font-medium">{step.customer_title || step.internal_name}</h2>
            {step.customer_description && (
              <p className="mt-1 text-sm text-muted-foreground">{step.customer_description}</p>
            )}
          </div>

          {stepFields.map((f) => {
            const e = evaluated.fields[f.id]!;
            const value = e.forcedValue ?? values[f.variable_name] ?? "";
            const catalogueType = fieldCatalogueType(f as never);
            const catalogueItems = catalogueType ? (catalogue[catalogueType] ?? []) : [];
            const options = catalogueType
              ? catalogueItems.map((item) => ({
                  id: item.id,
                  internal_value: item.id,
                  customer_label:
                    item.customer_price_idr == null
                      ? item.name
                      : `${item.name} · ${formatIdr(item.customer_price_idr)}`,
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
              </div>
            );
          })}

          {stepFields.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing to choose in this step.</p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => i - 1)}
            >
              Back
            </Button>
            <Button
              size="sm"
              disabled={stepIndex >= activeSteps.length - 1}
              onClick={() => setStepIndex((i) => i + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm">Promo code (optional)</Label>
              <Input
                value={promo}
                placeholder="Enter a code"
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          {quote?.promo_rejection && (
            <p className="text-xs text-destructive">{quote.promo_rejection}</p>
          )}

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">
              {quoting ? "Updating price…" : "Your price"}
            </span>
            <span className="text-2xl font-semibold">
              {quote ? formatIdr(quote.total_idr) : "—"}
            </span>
          </div>
          {quote && (quote.season_discount_idr > 0 || quote.promo_discount_idr > 0) && (
            <p className="text-xs text-muted-foreground">
              Before discount {formatIdr(quote.subtotal_idr)} · saving{" "}
              {formatIdr(quote.season_discount_idr + quote.promo_discount_idr)}
            </p>
          )}

          {quote && quote.configuration_issues.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {quote.configuration_issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          {quote && quote.errors.length > 0 && (
            <p className="text-xs text-destructive">
              Please finish the questions above to see your final price.
            </p>
          )}


          <Button className="w-full" disabled={!ready || quoting || booking} onClick={book}>
            {booking ? "Adding…" : "Add to cart"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Prices are indicative until your booking is confirmed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

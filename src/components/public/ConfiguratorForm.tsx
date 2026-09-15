import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  evaluateDependencies,
  stripInactiveAnswers,
  visibleStepFields,
  visibleSteps,

  type Field,
  type PreviewValues,
  type ProductBundle,
} from "@/lib/catalog";
import { formatIdr } from "@/lib/public-catalog";
import { readStoredPromoCode } from "@/lib/promo-code-storage";
import {
  catalogueHoursVariable,
  cataloguePeopleVariable,
  fieldCatalogueKey,
  type CatalogueItemsByKey,
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
  /** Active catalogue items per catalogue, resolved server-side. */
  catalogue?: CatalogueItemsByKey;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(savePackageConfiguration);
  const complete = useServerFn(completePackage);

  const [stepIndexRaw, setStepIndex] = useState(0);
  const [values, setValues] = useState<PreviewValues>(() => initialValues(bundle, savedAnswers));
  const [promo, setPromo] = useState(savedPromo ?? "");

  // The customer enters the code on Home; it is kept in their browser.
  useEffect(() => {
    const stored = readStoredPromoCode();
    if (stored) setPromo(stored);
  }, []);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  // Which catalogue item's photos are on screen per question, and which photo.
  const [shown, setShown] = useState<Record<string, string>>({});
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

  // Navigation only walks steps that still have a visible question.
  const activeSteps = useMemo(() => visibleSteps(bundle, values), [bundle, values]);
  const stepIndex = Math.min(stepIndexRaw, Math.max(activeSteps.length - 1, 0));
  const step = activeSteps[stepIndex];

  function set(f: Field, value: PreviewValues[string]) {
    setValues((v) => ({ ...v, [f.variable_name]: value }));
  }

  /** Extra catalogue choices (people, hours) live under their own answer keys. */
  function setVar(name: string, value: PreviewValues[string]) {
    setValues((v) => ({ ...v, [name]: value }));
  }


  const stepFields = step ? visibleStepFields(bundle, step.id, evaluated) : [];

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
            const catalogueKeyOfField = fieldCatalogueKey(f as never);
            const catalogueItems = catalogueKeyOfField ? (catalogue[catalogueKeyOfField] ?? []) : [];
            const options = catalogueKeyOfField
              ? catalogueItems.map((item) => ({
                  id: item.id,
                  internal_value: item.id,
                  description: item.description,
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

                {catalogueKeyOfField &&
                  (() => {
                    // The photos on screen belong to the last option the
                    // customer picked; earlier ones are taken as already seen.
                    const list = Array.isArray(values[f.variable_name])
                      ? (values[f.variable_name] as string[]).map(String)
                      : [];
                    const id =
                      f.field_type === "multi_select"
                        ? list.includes(shown[f.id] ?? "")
                          ? (shown[f.id] as string)
                          : (list[list.length - 1] ?? "")
                        : String(value);
                    const item = catalogueItems.find((i) => i.id === id);
                    if (!item) return null;
                    return (
                      <CatalogueItemPresentation
                        key={id}
                        photos={item.photo_urls}
                        name={item.name}
                        details={item.details}
                        size={f.photo_display_size}
                      />
                    );
                  })()}

                {catalogueKeyOfField && options.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No choices are available right now.
                  </p>
                )}
                {catalogueKeyOfField &&
                  (() => {
                    const chosen = catalogueItems.find((i) => i.id === String(value));
                    const variants = chosen?.variants ?? null;
                    if (!variants) return null;
                    const groups = [
                      {
                        name: cataloguePeopleVariable(f.variable_name),
                        label: variants.people_label,
                        choices: variants.people,
                      },
                      {
                        name: catalogueHoursVariable(f.variable_name),
                        label: variants.hours_label,
                        choices: variants.hours,
                      },
                    ].filter((g) => g.choices.length > 0);

                    return (
                      <div className="space-y-3 rounded-md border p-3">
                        {groups.map((g) => {
                          const current = String(values[g.name] ?? "");
                          return (
                            <div key={g.name} className="space-y-1.5">
                              <Label className="text-sm">
                                {g.label}
                                <span className="ml-1 text-destructive">*</span>
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                {g.choices.map((c) => (
                                  <Button
                                    key={c.value}
                                    type="button"
                                    size="sm"
                                    disabled={e.disabled}
                                    variant={current === String(c.value) ? "default" : "outline"}
                                    onClick={() => setVar(g.name, String(c.value))}
                                  >
                                    {c.value}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}




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
                          onClick={() => {
                            set(
                              f,
                              on
                                ? list.filter((x) => x !== o.internal_value)
                                : [...list, o.internal_value],
                            );
                            if (!on) setShown((s) => ({ ...s, [f.id]: o.internal_value }));
                          }}
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

/**
 * Photos of the chosen catalogue item. One photo shows on its own; several can
 * be stepped through. Purely presentational — no pricing, no answers.
 */
function CatalogueGallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const i = Math.min(index, photos.length - 1);
  const go = (delta: number) => setIndex((n) => (n + delta + photos.length) % photos.length);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md border border-border bg-muted/30">
        <img
          src={photos[i]}
          alt={name}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 px-2 py-1 text-sm"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 px-2 py-1 text-sm"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-[11px]">
              {i + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {photos.map((p, n) => (
            <button
              key={p}
              type="button"
              aria-label={`Photo ${n + 1}`}
              onClick={() => setIndex(n)}
              className={`h-1.5 w-1.5 rounded-full ${n === i ? "bg-foreground" : "bg-muted-foreground/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogueItemPresentation({
  photos,
  name,
  details,
  size,
}: {
  photos: string[];
  name: string;
  details: { label: string; value: string }[];
  size: string;
}) {
  const width = size === "small" ? "max-w-xs" : size === "medium" ? "max-w-lg" : "max-w-full";
  if (photos.length === 0 && details.length === 0) return null;

  return (
    <div className={`space-y-3 ${width}`}>
      {photos.length > 0 && <CatalogueGallery photos={photos} name={name} />}
      {details.length > 0 && (
        <dl className="grid gap-2 border-l border-border pl-3 text-sm">
          {details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`}>
              <dt className="text-xs font-medium text-muted-foreground">{detail.label}</dt>
              <dd className="whitespace-pre-line text-foreground">{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import {
  REQUIRED_FIELD_MESSAGE,
  isMissingRequiredAnswer,
  missingRequiredFields,
} from "@/lib/configurator-step-validation";
import { readStoredPromoCode } from "@/lib/promo-code-storage";
import {
  catalogueHoursVariable,
  catalogueItemChoiceValue,
  catalogueItemHoursVariable,
  catalogueItemPeopleVariable,
  cataloguePeopleVariable,
  fieldCatalogueKey,
  type CatalogueItemsByKey,
  type CatalogueVariants,
} from "@/lib/catalogue-bridge";

import { completePackage, savePackageConfiguration } from "@/lib/cart.functions";
import { PUBLIC_CART_KEY, usePublicCart } from "@/components/public/SiteHeader";
import { ConfiguratorOptionList } from "@/components/public/ConfiguratorOptionList";
import { QuoteNotes, QuoteTotal } from "@/components/public/ConfiguratorSummary";
import { ConfiguratorYesNo } from "@/components/public/ConfiguratorYesNo";
import { ConfiguratorQuantityStepper } from "@/components/public/ConfiguratorQuantityStepper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

/** Presentation only: the same total shown in the currency the customer picked. */
type QuoteDisplay = {
  fx: { currency_code: string; symbol: string } | null;
  total_customer: number | null;
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
  productTitle,
  productSummary,
  imageUrl,
}: {
  bundle: ProductBundle;
  packageId: string;
  savedAnswers: PreviewValues | null;
  savedPromo: string | null;
  /** Active catalogue items per catalogue, resolved server-side. */
  catalogue?: CatalogueItemsByKey;
  productTitle: string;
  productSummary: string | null;
  imageUrl: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(savePackageConfiguration);
  const complete = useServerFn(completePackage);

  const [stepIndexRaw, setStepIndex] = useState(0);
  // Direction of the last question change: 1 = forward (Next), -1 = back (Back).
  const [dir, setDir] = useState<1 | -1>(1);
  const [values, setValues] = useState<PreviewValues>(() => initialValues(bundle, savedAnswers));
  const [promo, setPromo] = useState(savedPromo ?? "");

  // The customer enters the code on Home; it is kept in their browser.
  useEffect(() => {
    const stored = readStoredPromoCode();
    if (stored) setPromo(stored);
  }, []);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [display, setDisplay] = useState<QuoteDisplay | null>(null);
  // The chosen currency lives server-side; the mini cart already exposes it.
  const cartCurrency = usePublicCart().data?.fx?.currency_code ?? null;
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  // Which catalogue item's photos are on screen per question, and which photo.
  const [shown, setShown] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldEls = useRef<Record<string, HTMLElement | null>>({});
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const seq = useRef(0);
  const saveChain = useRef(Promise.resolve());
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const configKey = JSON.stringify({
    packageId,
    values,
    promo: promo.trim() || null,
    cartCurrency,
  });
  const unsaved = savedKey !== configKey;

  // Debounced save+quote. Requests are serialised so an older write cannot
  // land in the DB after a newer one. seq ignores stale responses in the UI.
  useLayoutEffect(() => {
    const id = ++seq.current;
    const payload = {
      packageId,
      answers: values as never,
      month: null as null,
      promoCode: promo.trim() ? promo.trim() : null,
    };
    const key = configKey;
    setQuoting(true);
    const timer = setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => {
        if (seq.current !== id) return;
        try {
          const res = await save({ data: payload });
          if (seq.current !== id) return;
          setQuote(res.quote as Quote);
          setDisplay({
            fx: (res as any).fx ?? null,
            total_customer: (res as any).total_customer ?? null,
          });
          setSavedKey(key);
        } catch (e) {
          if (seq.current !== id) return;
          setQuote(null);
          setDisplay(null);
          toast.error(e instanceof Error ? e.message : "Price unavailable.");
        } finally {
          if (seq.current === id) setQuoting(false);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

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

  // Only show a second amount when there is a real customer currency and rate.
  const showCustomer =
    !!quote &&
    !!display?.fx &&
    display.fx.currency_code !== "IDR" &&
    display.total_customer != null;

  const stepFields = step ? visibleStepFields(bundle, step.id, evaluated) : [];

  useEffect(() => {
    setFieldErrors((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const id of ids) {
        const f = bundle.fields.find((x) => x.id === id);
        if (!f || !isMissingRequiredAnswer(f, evaluated.fields[id], values)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [bundle.fields, evaluated, values]);

  useEffect(() => {
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  const ready =
    !!quote &&
    !unsaved &&
    !quoting &&
    quote.purchasable &&
    quote.configuration_issues.length === 0 &&
    quote.errors.length === 0;
  const nearEnd = activeSteps.length <= 2 || stepIndex >= activeSteps.length - 2;

  async function book() {
    if (!ready || !nearEnd) return;
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
    <div className="space-y-10">
      <header className="flex items-start gap-4 sm:gap-6">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="size-20 shrink-0 object-cover object-center sm:size-24"
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{productTitle}</h1>
          {productSummary ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {productSummary}
            </p>
          ) : null}
        </div>
      </header>

      <div className="min-w-0 space-y-10">
          <section aria-labelledby="configurator-step-title" className="space-y-8">
            <div
              key={stepIndex}
              className={`space-y-8 ${dir === 1 ? "cbr-step-next" : "cbr-step-prev"}`}
            >
              <div className="space-y-3">
                {step.customer_title?.trim() ? (
                  <h2
                    id="configurator-step-title"
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    className="text-2xl font-semibold tracking-tight outline-none"
                  >
                    {step.customer_title.trim()}
                  </h2>
                ) : (
                  <h2
                    id="configurator-step-title"
                    ref={stepHeadingRef}
                    tabIndex={-1}
                    className="sr-only"
                  >
                    Step {stepIndex + 1}
                  </h2>
                )}
                {step.customer_description && (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {step.customer_description}
                  </p>
                )}
              </div>

              {stepFields.map((f) => {
                const e = evaluated.fields[f.id]!;
                const value = e.forcedValue ?? values[f.variable_name] ?? "";
                const fieldLabel = f.customer_label?.trim() ?? "";
                const labelId = fieldLabel || e.required ? `${f.id}-label` : undefined;
                const catalogueKeyOfField = fieldCatalogueKey(f as never);
                const catalogueItems = catalogueKeyOfField
                  ? (catalogue[catalogueKeyOfField] ?? [])
                  : [];
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
                  if (!fieldLabel && !f.help_text) return null;
                  return (
                    <div key={f.id} className="border-l border-border py-1 pl-4 text-sm">
                      {fieldLabel ? <p className="font-medium">{fieldLabel}</p> : null}
                      {f.help_text && <p className="mt-1 leading-relaxed text-muted-foreground">{f.help_text}</p>}
                    </div>
                  );
                }

                const errorId = `${f.id}-error`;
                const errorMessage = fieldErrors[f.id];

                return (
                  <div
                    key={f.id}
                    ref={(node) => {
                      fieldEls.current[f.id] = node;
                    }}
                    className="space-y-1.5"
                  >
                    {(fieldLabel || e.required) && (
                      <Label className="text-sm" id={labelId}>
                        {fieldLabel}
                        {e.required && <span className="ml-1 text-destructive">*</span>}
                      </Label>
                    )}
                    {f.help_text && <p className="text-xs text-muted-foreground">{f.help_text}</p>}

                    {f.field_type === "single_select" && (
                      <ConfiguratorOptionList
                        multiple={false}
                        options={options}
                        value={typeof value === "string" ? value : String(value ?? "")}
                        disabled={e.disabled}
                        error={!!errorMessage}
                        errorId={errorMessage ? errorId : undefined}
                        labelledBy={labelId}
                        onSelect={(internalValue) =>
                          set(f, value === internalValue && !e.required ? "" : internalValue)
                        }
                      />
                    )}

                    {f.field_type === "multi_select" && (
                      <ConfiguratorOptionList
                        multiple
                        options={options}
                        value={
                          Array.isArray(values[f.variable_name])
                            ? (values[f.variable_name] as string[])
                            : []
                        }
                        disabled={e.disabled}
                        error={!!errorMessage}
                        errorId={errorMessage ? errorId : undefined}
                        labelledBy={labelId}
                        onSelect={(internalValue) => {
                          const list = Array.isArray(values[f.variable_name])
                            ? (values[f.variable_name] as string[])
                            : [];
                          const on = list.includes(internalValue);
                          setValues((v) => {
                            const current = Array.isArray(v[f.variable_name])
                              ? (v[f.variable_name] as string[])
                              : [];
                            const next: PreviewValues = {
                              ...v,
                              [f.variable_name]: on
                                ? current.filter((x) => x !== internalValue)
                                : [...current, internalValue],
                            };
                            if (on) {
                              delete next[catalogueItemPeopleVariable(f.variable_name, internalValue)];
                              delete next[catalogueItemHoursVariable(f.variable_name, internalValue)];
                            }
                            return next;
                          });
                          if (!on) setShown((s) => ({ ...s, [f.id]: internalValue }));
                        }}
                      />
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
                      f.field_type !== "multi_select" &&
                      (() => {
                        const chosen = catalogueItems.find((i) => i.id === String(value));
                        const variants = chosen?.variants ?? null;
                        if (!variants) return null;
                        return (
                          <CatalogueVariantSteppers
                            variableName={f.variable_name}
                            itemId={chosen!.id}
                            variants={variants}
                            values={values}
                            perItem={false}
                            disabled={e.disabled}
                            onChange={setVar}
                          />
                        );
                      })()}

                    {catalogueKeyOfField &&
                      f.field_type === "multi_select" &&
                      (Array.isArray(values[f.variable_name])
                        ? (values[f.variable_name] as string[])
                        : []
                      ).map((id) => {
                        const item = catalogueItems.find((i) => i.id === id);
                        if (!item?.variants) return null;
                        if (item.variants.people.length === 0 && item.variants.hours.length === 0) {
                          return null;
                        }
                        return (
                          <div key={id} className="space-y-4 border-t border-border pt-5">
                            <p className="text-sm font-medium">{item.name}</p>
                            <CatalogueVariantSteppers
                              variableName={f.variable_name}
                              itemId={id}
                              variants={item.variants}
                              values={values}
                              perItem
                              disabled={e.disabled}
                              onChange={setVar}
                            />
                          </div>
                        );
                      })}

                    {(f.field_type === "quantity" || f.field_type === "number") && (
                      <Input
                        id={f.id}
                        inputMode="decimal"
                        disabled={e.disabled}
                        value={String(value)}
                        min={e.min ?? undefined}
                        max={e.max ?? undefined}
                        aria-invalid={errorMessage ? true : undefined}
                        aria-describedby={errorMessage ? errorId : undefined}
                        className="cbr-config-field"
                        onChange={(ev) => set(f, ev.target.value)}
                      />
                    )}

                    {f.field_type === "text" && (
                      <Input
                        id={f.id}
                        disabled={e.disabled}
                        value={String(value)}
                        aria-invalid={errorMessage ? true : undefined}
                        aria-describedby={errorMessage ? errorId : undefined}
                        className="cbr-config-field"
                        onChange={(ev) => set(f, ev.target.value)}
                      />
                    )}

                    {(f.field_type === "date" || f.field_type === "date_range") && (
                      <Input
                        id={f.id}
                        type="date"
                        disabled={e.disabled}
                        value={String(value)}
                        aria-invalid={f.field_type === "date" && errorMessage ? true : undefined}
                        aria-describedby={
                          f.field_type === "date" && errorMessage ? errorId : undefined
                        }
                        className="cbr-config-field"
                        onChange={(ev) => set(f, ev.target.value)}
                      />
                    )}

                    {f.field_type === "boolean" && (
                      <ConfiguratorYesNo
                        value={
                          values[f.variable_name] === true
                            ? true
                            : values[f.variable_name] === false
                              ? false
                              : undefined
                        }
                        disabled={e.disabled}
                        error={!!errorMessage}
                        errorId={errorMessage ? errorId : undefined}
                        labelledBy={labelId}
                        onSelect={(v) => set(f, v)}
                      />
                    )}
                    {errorMessage ? (
                      <p id={errorId} role="alert" className="text-xs text-destructive">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              {stepFields.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing to choose in this step.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
              <button
                type="button"
                className="cbr-config-nav"
                disabled={stepIndex === 0}
                onClick={() => {
                  setFieldErrors({});
                  setDir(-1);
                  setStepIndex((i) => i - 1);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="cbr-config-nav"
                disabled={stepIndex >= activeSteps.length - 1}
                onClick={() => {
                  const missing = missingRequiredFields(stepFields, evaluated.fields, values);
                  if (missing.length > 0) {
                    setFieldErrors(
                      Object.fromEntries(missing.map((f) => [f.id, REQUIRED_FIELD_MESSAGE])),
                    );
                    const first = missing[0];
                    if (!first) return;
                    requestAnimationFrame(() => {
                      const root = fieldEls.current[first.id];
                      root?.scrollIntoView({ behavior: "smooth", block: "center" });
                      root
                        ?.querySelector<HTMLElement>(
                          "input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [role='switch']:not([data-disabled])",
                        )
                        ?.focus();
                    });
                    return;
                  }
                  setFieldErrors({});
                  setDir(1);
                  setStepIndex((i) => i + 1);
                }}
              >
                Next
              </button>
            </div>
          </section>

          <div className="space-y-5 border-t border-border pt-8">
              <QuoteTotal
                quote={quote}
                display={display}
                quoting={quoting}
                unsaved={unsaved}
                showCustomer={showCustomer}
              />
              <QuoteNotes quote={quote} />
              <button
                type="button"
                className="cbr-config-primary"
                disabled={!ready || !nearEnd || booking}
                aria-busy={booking || undefined}
                onClick={book}
              >
                {booking ? "Adding…" : "Add to cart"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Prices set in IDR (RP). Your bank sets the final exchange rate.
              </p>
          </div>
      </div>
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
      <div className="relative isolate overflow-hidden bg-secondary">
        <img
          src={photos[i]}
          alt={name}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover object-center"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 min-h-11 min-w-11 bg-background/70 px-2 text-sm"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-11 min-w-11 bg-background/70 px-2 text-sm"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 bg-background/70 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em]">
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

function CatalogueVariantSteppers({
  variableName,
  itemId,
  variants,
  values,
  perItem,
  disabled,
  onChange,
}: {
  variableName: string;
  itemId: string;
  variants: CatalogueVariants;
  values: PreviewValues;
  perItem: boolean;
  disabled?: boolean;
  onChange: (name: string, value: PreviewValues[string]) => void;
}) {
  const groups = [
    {
      kind: "people" as const,
      name: perItem
        ? catalogueItemPeopleVariable(variableName, itemId)
        : cataloguePeopleVariable(variableName),
      label: variants.people_label,
      choices: variants.people,
    },
    {
      kind: "hours" as const,
      name: perItem
        ? catalogueItemHoursVariable(variableName, itemId)
        : catalogueHoursVariable(variableName),
      label: variants.hours_label,
      choices: variants.hours,
    },
  ].filter((g) => g.choices.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const n = catalogueItemChoiceValue(
          values as Record<string, unknown>,
          variableName,
          itemId,
          g.kind,
          perItem,
        );
        const current = n == null ? "" : String(n);
        return (
          <div key={g.name} className="space-y-2">
            <Label id={`${g.name}-label`} className="text-sm">
              {g.label}
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <ConfiguratorQuantityStepper
              choices={g.choices.map((c) => c.value)}
              value={current}
              disabled={!!disabled}
              labelledBy={`${g.name}-label`}
              decreaseLabel={`Decrease ${g.label}`}
              increaseLabel={`Increase ${g.label}`}
              onChange={(next) => onChange(g.name, next)}
            />
          </div>
        );
      })}
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

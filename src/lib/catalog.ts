import type { Database } from "@/integrations/supabase/types";
import { isCatalogueField } from "@/lib/catalogue-bridge";


/**
 * Shared catalog/configurator types, reads, validation and dependency
 * evaluation. Reads run through the browser client so RLS stays authoritative
 * (staff read, admin write).
 */

type T = Database["public"]["Tables"];

export type Product = T["products"]["Row"];
export type ProductTranslation = T["product_translations"]["Row"];
export type Category = T["categories"]["Row"];
export type Placement = T["placements"]["Row"];
export type ComponentTemplate = T["component_templates"]["Row"];
export type ProductComponent = T["product_components"]["Row"];
export type ConfigFlow = T["config_flows"]["Row"];
export type Step = T["steps"]["Row"];
export type Field = T["fields"]["Row"];
export type FieldOption = T["field_options"]["Row"];
export type Dependency = T["dependencies"]["Row"];

export const PRODUCT_STATUSES = ["draft", "active", "inactive", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_KINDS = ["package", "insurance"] as const;

export const UNIT_BASES = [
  { value: "fixed", label: "Fixed" },
  { value: "per_person", label: "Per person" },
  { value: "per_day", label: "Per day" },
  { value: "per_night", label: "Per night" },
  { value: "per_session", label: "Per session" },
] as const;

export const FIELD_TYPES = [
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
  { value: "quantity", label: "Quantity" },
  { value: "number", label: "Number" },
  { value: "text", label: "Text" },
  { value: "date", label: "Date" },
  { value: "date_range", label: "Date range" },
  { value: "boolean", label: "Yes / no" },
  { value: "info_block", label: "Info block" },
] as const;

export const OPERATORS = [
  { value: "equals", label: "is equal to", needsValue: true },
  { value: "not_equals", label: "is not equal to", needsValue: true },
  { value: "greater_than", label: "is greater than", needsValue: true },
  { value: "less_than", label: "is less than", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
  { value: "is_true", label: "is yes", needsValue: false },
  { value: "is_false", label: "is no", needsValue: false },
] as const;

export const DEPENDENCY_ACTIONS = [
  { value: "show", label: "Show", needsValue: false },
  { value: "hide", label: "Hide", needsValue: false },
  { value: "require", label: "Make required", needsValue: false },
  { value: "enable", label: "Enable", needsValue: false },
  { value: "disable", label: "Disable", needsValue: false },
  { value: "set_value", label: "Set value", needsValue: true },
  { value: "set_minimum", label: "Set minimum", needsValue: true },
  { value: "set_maximum", label: "Set maximum", needsValue: true },
  { value: "reset_remove", label: "Reset / remove", needsValue: false },
] as const;

export const SELECT_FIELD_TYPES = ["single_select", "multi_select"];

export type ProductBundle = {
  product: Product;
  translation: ProductTranslation | null;
  categoryIds: string[];
  placements: { placement_id: string; display_order: number }[];
  components: ProductComponent[];
  flow: ConfigFlow | null;
  steps: Step[];
  fields: Field[];
  options: FieldOption[];
  dependencies: Dependency[];
};

export const MASTER_LANGUAGE = "en";

/** Private bucket for the optional package hero image. */
export const PRODUCT_MEDIA_BUCKET = "product-media";

/** Private, non-guessable object path for one product image. */
export function productImagePath(productId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-").slice(-80);
  return `${productId}/${crypto.randomUUID()}-${safe}`;
}

/** Private path for the optional intermediate-page photo. */
export function productLandingImagePath(productId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-").slice(-80);
  return `${productId}/landing/${crypto.randomUUID()}-${safe}`;
}

/** Private path for an optional configurator-step photo. */
export function productStepImagePath(productId: string, stepId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "-").slice(-80);
  return `${productId}/steps/${stepId}/${crypto.randomUUID()}-${safe}`;
}

/**
 * Activation check for one choice question, shared by the browser and the
 * server. A manual question needs at least one active option of its own; a
 * catalogue-backed one needs at least one active customer-visible item in the
 * catalogue it points at. A catalogue source with no valid catalogue chosen
 * counts as manual, so it still needs options and cannot silently pass.
 */
export function selectFieldActivationError(
  field: { internal_name?: string | null; option_source?: string | null; catalogue_type?: string | null; variable_name: string; field_type: string; id: string },
  counts: { activeManualOptions: number; catalogueItems: number },
): string | null {
  if (!SELECT_FIELD_TYPES.includes(field.field_type)) return null;
  if (isCatalogueField(field as never)) {
    return counts.catalogueItems > 0
      ? null
      : "A choice question uses a catalogue with no active item. Add or activate catalogue items before activating.";
  }
  return counts.activeManualOptions > 0
    ? null
    : "Every choice question needs at least one active option before activating.";
}


/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export type ValidationIssue = { level: "error" | "warning"; message: string };

export function validateBundle(b: ProductBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  if (!b.product.internal_name.trim()) err("The product has no internal name.");
  if (!b.translation?.title?.trim()) err("English title is missing.");
  if (!b.translation?.summary?.trim()) warn("English short summary is missing.");
  if (!b.translation?.body?.trim()) warn("English description is missing.");
  if (b.categoryIds.length === 0) warn("The product is not in any category.");
  if (b.components.length === 0) warn("The product has no components.");

  const seen = new Set<string>();
  for (const f of b.fields) {
    if (seen.has(f.variable_name)) err(`Variable name "${f.variable_name}" is used more than once.`);
    seen.add(f.variable_name);
  }

  const activeSteps = b.steps.filter((s) => s.is_active);
  if (activeSteps.length === 0) err("The configurator has no active step.");
  for (const s of activeSteps) {
    const stepFields = b.fields.filter((f) => f.step_id === s.id && f.is_active);
    if (stepFields.length === 0) warn(`Step "${s.internal_name}" has no active field.`);
    if (!s.customer_title?.trim()) warn(`Step "${s.internal_name}" has no customer title.`);
  }

  for (const f of b.fields.filter((x) => x.is_active)) {
    if (!f.customer_label?.trim() && f.field_type !== "info_block") {
      warn(`Field "${f.internal_name}" has no customer label.`);
    }
    if (SELECT_FIELD_TYPES.includes(f.field_type)) {
      const active = b.options.filter((o) => o.field_id === f.id && o.is_active);
      // A catalogue-backed question takes its choices from the catalogue, so it
      // never needs manual options.
      if (isCatalogueField(f as never)) {
        // nothing to check here; the catalogue is the source of truth
      } else if (active.length === 0) {
        if (f.is_required) {
          err(`Field "${f.internal_name}" is a required select field with no active option.`);
        } else {
          warn(`Field "${f.internal_name}" is a select field with no active option yet.`);
        }
      }
      if (f.field_type === "single_select" && active.filter((o) => o.is_default).length > 1) {
        err(`Field "${f.internal_name}" has more than one default option.`);
      }
    }

    if (f.min_value != null && f.max_value != null && Number(f.min_value) > Number(f.max_value)) {
      err(`Field "${f.internal_name}" has a minimum above its maximum.`);
    }
  }

  const fieldIds = new Set(b.fields.map((f) => f.id));
  const optionIds = new Set(b.options.map((o) => o.id));
  for (const d of b.dependencies) {
    if (!fieldIds.has(d.source_field_id)) err("A dependency refers to a field that no longer exists.");
    if (d.source_option_id && !optionIds.has(d.source_option_id)) {
      err("A dependency refers to an option that no longer exists.");
    }
    if (!d.target_field_id && !d.target_option_id) err("A dependency has no target.");
    if (d.target_field_id && !fieldIds.has(d.target_field_id)) {
      err("A dependency targets a field that no longer exists.");
    }
    if (d.target_option_id && !optionIds.has(d.target_option_id)) {
      err("A dependency targets an option that no longer exists.");
    }
    const action = DEPENDENCY_ACTIONS.find((a) => a.value === d.action);
    if (action?.needsValue && !d.action_value?.trim()) {
      err(`A "${action.label}" dependency has no value.`);
    }
    const op = OPERATORS.find((o) => o.value === d.operator);
    if (op?.needsValue && !d.compare_value?.trim() && !d.source_option_id) {
      err(`A dependency using "${op.label}" has no comparison value.`);
    }
  }

  for (const c of b.components) {
    if (c.max_quantity != null && Number(c.min_quantity) > Number(c.max_quantity)) {
      err(`Component "${c.internal_name}" has a minimum quantity above its maximum.`);
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Dependency evaluation (preview)                                    */
/* ------------------------------------------------------------------ */

export type FieldEffect = {
  hidden: boolean;
  forcedVisible: boolean;
  required: boolean;
  disabled: boolean;
  min: number | null;
  max: number | null;
  forcedValue: string | null;
  reset: boolean;
};

export type PreviewValues = Record<string, string | string[] | boolean | number | null>;

function asText(v: PreviewValues[string]): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(",");
  return String(v);
}

/** Generic yes/no reading, so "is yes"/"is no" also work on select answers. */
const TRUTHY = ["true", "yes", "y", "1", "on"];
const FALSY = ["false", "no", "n", "0", "off"];

function isYes(v: PreviewValues[string]): boolean {
  if (v === true) return true;
  if (Array.isArray(v)) return v.some((x) => TRUTHY.includes(String(x).trim().toLowerCase()));
  return TRUTHY.includes(asText(v).trim().toLowerCase());
}

function isNo(v: PreviewValues[string]): boolean {
  if (v === false) return true;
  const text = asText(v).trim().toLowerCase();
  if (Array.isArray(v)) return !isYes(v);
  return text === "" || FALSY.includes(text);
}

function conditionMet(d: Dependency, value: PreviewValues[string]): boolean {
  const text = asText(value);
  const target = d.source_option_id ? (d.compare_value ?? "") : (d.compare_value ?? "");
  switch (d.operator) {
    case "equals":
      return Array.isArray(value) ? value.includes(target) : text === target;
    case "not_equals":
      return Array.isArray(value) ? !value.includes(target) : text !== target;
    case "greater_than":
      return Number(text) > Number(target);
    case "less_than":
      return Number(text) < Number(target);
    case "contains":
      return text.includes(target);
    case "is_empty":
      return text.trim() === "";
    case "is_not_empty":
      return text.trim() !== "";
    case "is_true":
      return isYes(value);
    case "is_false":
      return isNo(value);
    default:
      return false;
  }
}


export function evaluateDependencies(
  b: ProductBundle,
  values: PreviewValues,
): { fields: Record<string, FieldEffect>; hiddenOptionIds: Set<string> } {
  const effects: Record<string, FieldEffect> = {};
  const hiddenOptionIds = new Set<string>();

  for (const f of b.fields) {
    effects[f.id] = {
      hidden: false,
      forcedVisible: false,
      required: f.is_required,
      disabled: false,
      min: f.min_value == null ? null : Number(f.min_value),
      max: f.max_value == null ? null : Number(f.max_value),
      forcedValue: null,
      reset: false,
    };
  }

  for (const d of b.dependencies) {
    if (!d.is_active) continue;
    const source = b.fields.find((f) => f.id === d.source_field_id);
    if (!source) continue;

    // An option-scoped condition compares against that option's own value.
    let dep = d;
    if (d.source_option_id) {
      const opt = b.options.find((o) => o.id === d.source_option_id);
      if (opt) dep = { ...d, compare_value: d.compare_value ?? opt.internal_value };
    }
    if (!conditionMet(dep, values[source.variable_name] ?? null)) continue;

    if (d.target_option_id && (d.action === "hide" || d.action === "disable")) {
      hiddenOptionIds.add(d.target_option_id);
      continue;
    }
    const targetFieldId =
      d.target_field_id ??
      b.options.find((o) => o.id === d.target_option_id)?.field_id ??
      null;
    if (!targetFieldId) continue;
    const e = effects[targetFieldId];
    if (!e) continue;

    switch (d.action) {
      case "show":
        e.forcedVisible = true;
        e.hidden = false;
        break;
      case "hide":
        e.hidden = true;
        break;
      case "require":
        e.required = true;
        break;
      case "enable":
        e.disabled = false;
        break;
      case "disable":
        e.disabled = true;
        break;
      case "set_value":
        e.forcedValue = d.action_value ?? null;
        break;
      case "set_minimum":
        e.min = Number(d.action_value);
        break;
      case "set_maximum":
        e.max = Number(d.action_value);
        break;
      case "reset_remove":
        e.reset = true;
        break;
    }
  }

  return { fields: effects, hiddenOptionIds };
}

/**
 * Fields of a step that the customer can actually answer right now: active,
 * and not hidden by the existing dependency evaluation. Generic — no product
 * or field knowledge is hard-coded.
 */
export function visibleStepFields(
  b: ProductBundle,
  stepId: string,
  evaluated: ReturnType<typeof evaluateDependencies>,
): Field[] {
  return b.fields
    .filter((f) => f.step_id === stepId && f.is_active)
    .filter((f) => !evaluated.fields[f.id]?.hidden || evaluated.fields[f.id]?.forcedVisible);
}

/**
 * Navigation source of truth for the public configurator: active steps that
 * still have at least one visible field. Steps whose questions are all hidden
 * by dependencies are skipped entirely, so no empty step is ever shown.
 */
export function visibleSteps(b: ProductBundle, values: PreviewValues) {
  const evaluated = evaluateDependencies(b, values);
  return b.steps
    .filter((s) => s.is_active)
    .filter((s) => visibleStepFields(b, s.id, evaluated).length > 0);
}

/**
 * Removes answers for fields that are currently hidden or reset by the saved
 * dependency actions, so they are never validated, priced or persisted as an
 * active configuration value. Generic: it works from the dependency records.
 */
export function stripInactiveAnswers(b: ProductBundle, values: PreviewValues): PreviewValues {
  const { fields: effects } = evaluateDependencies(b, values);
  const next: PreviewValues = { ...values };
  for (const f of b.fields) {
    const e = effects[f.id];
    if (!e) continue;
    const inactive = (e.hidden && !e.forcedVisible) || e.reset;
    if (!inactive) continue;
    if (f.field_type === "multi_select") next[f.variable_name] = [];
    else if (f.field_type === "boolean") next[f.variable_name] = false;
    else next[f.variable_name] = "";
  }
  return next;
}

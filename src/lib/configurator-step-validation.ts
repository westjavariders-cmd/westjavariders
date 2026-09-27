import type { Field, FieldEffect, PreviewValues } from "@/lib/catalog";

/** Generic UI copy for a missing required answer. Not product content. */
export const REQUIRED_FIELD_MESSAGE = "This field is required";

/**
 * Whether a visible required field still has no usable answer.
 * Hidden/reset fields and `date_range` never fail: hide is owned by
 * evaluateDependencies, and date_range is informational only.
 */
export function isMissingRequiredAnswer(
  field: Field,
  effect: FieldEffect | undefined,
  values: PreviewValues,
): boolean {
  if (!effect) return false;
  if (field.field_type === "info_block") return false;
  if (field.field_type === "date_range") return false;
  if (effect.hidden && !effect.forcedVisible) return false;
  if (effect.reset) return false;
  if (!effect.required) return false;

  const raw: PreviewValues[string] | undefined =
    effect.forcedValue != null ? effect.forcedValue : values[field.variable_name];
  return !hasStepAnswer(field, raw);
}

export function missingRequiredFields(
  visibleFields: Field[],
  effects: Record<string, FieldEffect>,
  values: PreviewValues,
): Field[] {
  return visibleFields.filter((f) => isMissingRequiredAnswer(f, effects[f.id], values));
}

function hasStepAnswer(field: Field, raw: PreviewValues[string] | undefined): boolean {
  switch (field.field_type) {
    case "boolean":
      return raw === true || raw === false;
    case "multi_select":
      return Array.isArray(raw) && raw.length > 0;
    case "quantity":
    case "number":
      return isFiniteNumericAnswer(raw);
    case "text":
      return typeof raw === "string" && raw.trim() !== "";
    case "date": {
      if (typeof raw !== "string") return false;
      const s = raw.trim();
      return s !== "" && !Number.isNaN(Date.parse(s));
    }
    case "single_select":
    case "date_range":
    case "info_block":
    default:
      return isNonEmptyChoice(raw);
  }
}

/** 0 is a real quantity; "" / null / non-numeric are not. */
function isFiniteNumericAnswer(raw: PreviewValues[string] | undefined): boolean {
  if (typeof raw === "number") return Number.isFinite(raw);
  if (raw == null || typeof raw === "boolean") return false;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first != null && first !== "" && Number.isFinite(Number(first));
  }
  const s = String(raw).trim();
  return s !== "" && Number.isFinite(Number(s));
}

function isNonEmptyChoice(raw: PreviewValues[string] | undefined): boolean {
  if (raw == null || raw === false) return false;
  if (typeof raw === "boolean") return true;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === "number") return Number.isFinite(raw);
  return String(raw).trim() !== "";
}

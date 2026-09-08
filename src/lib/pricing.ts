import type { Database } from "@/integrations/supabase/types";
import {
  evaluateDependencies,
  type PreviewValues,
  type ProductBundle,
} from "@/lib/catalog";

/**
 * Pure pricing core: no database, no React, no browser APIs.
 *
 * Money is held as exact scaled integers (BigInt, six decimal places) so no
 * binary floating point ever touches a price. Components are never rounded on
 * their own; only the final total becomes a whole number of Rupiah.
 */

type T = Database["public"]["Tables"];
export type ProductPricing = T["product_pricing"]["Row"];
export type PricingRule = T["pricing_rules"]["Row"];
export type PricingTier = T["pricing_tiers"]["Row"];
export type FormulaVersion = T["formula_versions"]["Row"];
export type PricingTestCase = T["pricing_test_cases"]["Row"];

export const PRICING_MODES = [
  { value: "structured", label: "Structured rules" },
  { value: "formula", label: "Advanced formula" },
] as const;

export const PRICING_RULE_TYPES = [
  { value: "fixed", label: "Fixed amount" },
  { value: "variable_times_amount", label: "Answer × amount" },
  { value: "component_quantity", label: "Component × quantity" },
  { value: "conditional", label: "Conditional amount" },
  { value: "tier", label: "Tier lookup" },
] as const;

export const PRICING_CONDITION_OPERATORS = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
  { value: "is_true", label: "is yes" },
  { value: "is_false", label: "is no" },
] as const;

export const NUMERIC_FIELD_TYPES = ["quantity", "number"];

/* ------------------------------------------------------------------ */
/* Exact scaled arithmetic                                            */
/* ------------------------------------------------------------------ */

const SCALE = 1_000_000n;

export type Exact = bigint;

export function fromNumberLike(value: string | number): Exact {
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new PricingError(`"${value}" is not a number.`);
  const negative = text.startsWith("-");
  const parts = text.replace("-", "").split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const padded = (frac + "000000").slice(0, 6);
  const result = BigInt(whole) * SCALE + BigInt(padded);
  return negative ? -result : result;
}

export const exactMul = (a: Exact, b: Exact): Exact => (a * b) / SCALE;

export function exactDiv(a: Exact, b: Exact): Exact {
  if (b === 0n) throw new PricingError("This calculation divides by zero.");
  return (a * SCALE) / b;
}

/** Whole Rupiah, half-up. Currency conversion and rounding up belong to a later phase. */
export function toRupiah(a: Exact): number {
  const half = SCALE / 2n;
  const rounded = a >= 0n ? (a + half) / SCALE : -((-a + half) / SCALE);
  return Number(rounded);
}

export function exactToString(a: Exact): string {
  const negative = a < 0n;
  const v = negative ? -a : a;
  const whole = v / SCALE;
  const frac = (v % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export class PricingError extends Error {}

/* ------------------------------------------------------------------ */
/* Inputs resolved from the Phase 3 configuration                     */
/* ------------------------------------------------------------------ */

export type PricingValue =
  | { type: "number"; value: Exact }
  | { type: "boolean"; value: boolean }
  | { type: "string"; value: string }
  | { type: "list"; value: string[] };

export type PricingInputs = Record<string, PricingValue>;

/**
 * Turns saved configurator answers into typed pricing inputs keyed by the
 * existing `variable_name`. Dependencies are applied first, so hidden or reset
 * answers never contribute to a price.
 */
export function resolveInputs(bundle: ProductBundle, values: PreviewValues): PricingInputs {
  const { fields: effects } = evaluateDependencies(bundle, values);
  const inputs: PricingInputs = {};

  for (const f of bundle.fields) {
    if (!f.is_active || f.field_type === "info_block") continue;
    const effect = effects[f.id];
    if (effect?.hidden && !effect.forcedVisible) continue;
    if (effect?.reset) continue;

    let raw = values[f.variable_name];
    if (effect?.forcedValue != null) raw = effect.forcedValue;
    if (raw == null || raw === "") continue;

    if (f.field_type === "boolean") {
      inputs[f.variable_name] = { type: "boolean", value: raw === true || raw === "true" };
      continue;
    }
    if (f.field_type === "multi_select") {
      const list = Array.isArray(raw) ? raw : [String(raw)];
      inputs[f.variable_name] = { type: "list", value: list };
      continue;
    }
    if (NUMERIC_FIELD_TYPES.includes(f.field_type)) {
      try {
        inputs[f.variable_name] = { type: "number", value: fromNumberLike(raw as string | number) };
      } catch {
        // A non-numeric answer in a numeric field is reported by validation.
      }
      continue;
    }
    inputs[f.variable_name] = { type: "string", value: String(raw) };
  }

  return inputs;
}

function numberInput(inputs: PricingInputs, name: string | null): Exact | null {
  if (!name) return null;
  const v = inputs[name];
  if (!v || v.type !== "number") return null;
  return v.value;
}

/* ------------------------------------------------------------------ */
/* Structured rules                                                   */
/* ------------------------------------------------------------------ */

export type BreakdownLine = {
  source: string;
  label: string;
  detail: string;
  amount_idr_exact: string;
};

export type PriceResult = {
  total_idr: number;
  mode: "structured" | "formula";
  lines: BreakdownLine[];
  errors: string[];
};

function conditionHolds(rule: PricingRule, inputs: PricingInputs): boolean {
  const value = rule.condition_variable ? inputs[rule.condition_variable] : undefined;
  const compare = rule.condition_value ?? "";
  switch (rule.condition_operator) {
    case "is_true":
      return value?.type === "boolean" && value.value;
    case "is_false":
      return !(value?.type === "boolean" && value.value);
    case "equals":
      if (!value) return false;
      if (value.type === "list") return value.value.includes(compare);
      if (value.type === "number") return value.value === fromNumberLike(compare);
      return String(value.value) === compare;
    case "not_equals":
      if (!value) return true;
      if (value.type === "list") return !value.value.includes(compare);
      if (value.type === "number") return value.value !== fromNumberLike(compare);
      return String(value.value) !== compare;
    case "greater_than":
      return value?.type === "number" && value.value > fromNumberLike(compare);
    case "less_than":
      return value?.type === "number" && value.value < fromNumberLike(compare);
    default:
      return false;
  }
}

/**
 * The multiplier for a component. A component pricing entry may name its own
 * quantity question (`override`); otherwise the pricing row's mapping for the
 * component's basis is used. `fixed` is always one unit.
 */
export function componentMultiplier(
  basis: string,
  pricing: ProductPricing,
  inputs: PricingInputs,
  override?: string | null,
): { value: Exact; variable: string | null; missing: boolean } {
  if (override) {
    const value = numberInput(inputs, override);
    if (value == null) return { value: 0n, variable: override, missing: true };
    return { value, variable: override, missing: false };
  }
  if (basis === "fixed") return { value: SCALE, variable: null, missing: false };
  const variable =
    basis === "per_person"
      ? pricing.people_variable
      : basis === "per_day"
        ? pricing.days_variable
        : basis === "per_night"
          ? pricing.nights_variable
          : basis === "per_session"
            ? pricing.sessions_variable
            : null;
  const value = numberInput(inputs, variable);
  if (value == null) return { value: 0n, variable, missing: true };
  return { value, variable, missing: false };
}

export function priceProduct(args: {
  bundle: ProductBundle;
  pricing: ProductPricing;
  rules: PricingRule[];
  tiers: PricingTier[];
  formula: FormulaVersion | null;
  inputs: PricingInputs;
}): PriceResult {
  const { bundle, pricing, rules, tiers, formula, inputs } = args;
  const lines: BreakdownLine[] = [];
  const errors: string[] = [];

  const push = (source: string, label: string, detail: string, amount: Exact) =>
    lines.push({ source, label, detail, amount_idr_exact: exactToString(amount) });

  if (pricing.mode === "formula") {
    if (!formula) {
      return { total_idr: 0, mode: "formula", lines: [], errors: ["No active formula version."] };
    }
    try {
      const value = evaluateFormula(formula.expression, formulaScope(bundle, pricing, inputs));
      if (value.type !== "number") throw new PricingError("The formula must produce a number.");
      push(`formula:v${formula.version}`, `Formula v${formula.version}`, formula.expression, value.value);
      const total = toRupiah(value.value);
      if (total < 0) errors.push("The formula produced a negative price.");
      return { total_idr: total, mode: "formula", lines, errors };
    } catch (e) {
      return {
        total_idr: 0,
        mode: "formula",
        lines: [],
        errors: [e instanceof Error ? e.message : "The formula could not be evaluated."],
      };
    }
  }

  let total: Exact = fromNumberLike(pricing.base_amount_idr);
  push("base", "Base price", "Fixed base amount", total);

  for (const rule of rules.filter((r) => r.is_active).sort((a, b) => a.display_order - b.display_order)) {
    let amount: Exact = 0n;
    let detail = "";

    try {
      switch (rule.rule_type) {
        case "fixed": {
          amount = fromNumberLike(rule.amount_idr ?? 0);
          detail = "fixed amount";
          break;
        }
        case "variable_times_amount": {
          const q = numberInput(inputs, rule.variable_name);
          if (q == null) {
            errors.push(`Rule "${rule.label}" has no value for "${rule.variable_name ?? "?"}".`);
            continue;
          }
          amount = exactMul(q, fromNumberLike(rule.amount_idr ?? 0));
          detail = `${rule.variable_name} = ${exactToString(q)} × ${rule.amount_idr ?? 0}`;
          break;
        }
        case "component_quantity": {
          const component = bundle.components.find((c) => c.id === rule.component_id);
          if (!component || !component.is_active) {
            errors.push(`Rule "${rule.label}" refers to a component that is missing or inactive.`);
            continue;
          }
          // A component entry may be limited to a configurator condition, e.g.
          // "media_services contains photography". No condition means always charged.
          if (rule.condition_variable && !conditionHolds(rule, inputs)) {
            push(`rule:${rule.id}`, rule.label, "condition not met", 0n);
            continue;
          }
          const m = componentMultiplier(component.unit_basis, pricing, inputs, rule.quantity_variable);
          if (m.missing) {
            errors.push(
              `Component "${component.internal_name}" needs a value for ${m.variable ?? "its quantity"}.`,
            );
            continue;
          }
          const unit = fromNumberLike(component.customer_price);
          amount = exactMul(unit, m.value);
          detail = `${component.internal_name}: ${exactToString(unit)} × ${exactToString(m.value)}${
            m.variable ? ` (${m.variable})` : ""
          }`;
          break;
        }
        case "conditional": {
          if (!conditionHolds(rule, inputs)) {
            push(`rule:${rule.id}`, rule.label, "condition not met", 0n);
            continue;
          }
          amount = fromNumberLike(rule.amount_idr ?? 0);
          detail = "condition met";
          break;
        }
        case "tier": {
          const q = numberInput(inputs, rule.variable_name);
          if (q == null) {
            errors.push(`Tier rule "${rule.label}" has no value for "${rule.variable_name ?? "?"}".`);
            continue;
          }
          const match = tiers
            .filter((t) => t.rule_id === rule.id)
            .sort((a, b) => a.display_order - b.display_order)
            .find((t) => {
              const from = fromNumberLike(t.from_value);
              const to = t.to_value == null ? null : fromNumberLike(t.to_value);
              return q >= from && (to == null || q <= to);
            });
          if (!match) {
            errors.push(`Tier rule "${rule.label}" has no tier for ${exactToString(q)}.`);
            continue;
          }
          amount = fromNumberLike(match.amount_idr);
          detail = `${rule.variable_name} = ${exactToString(q)} → tier total`;
          break;
        }
      }
    } catch (e) {
      errors.push(`Rule "${rule.label}": ${e instanceof Error ? e.message : "invalid"}`);
      continue;
    }

    if (rule.sign === "subtract") amount = -amount;
    total += amount;
    push(`rule:${rule.id}`, rule.label, detail, amount);
  }

  const result = toRupiah(total);
  if (result < 0) errors.push("The configured pricing produces a negative price.");
  return { total_idr: result, mode: "structured", lines, errors };
}

/* ------------------------------------------------------------------ */
/* Restricted formula language                                        */
/* ------------------------------------------------------------------ */

/**
 * The only values a formula may reference: this product's configurator
 * answers, the mapped quantity variables, `base`, and this product's component
 * customer prices as `component_<n>`. Nothing else is reachable.
 */
export function formulaScope(
  bundle: ProductBundle,
  pricing: ProductPricing,
  inputs: PricingInputs,
): PricingInputs {
  const scope: PricingInputs = { ...inputs };
  scope["base"] = { type: "number", value: fromNumberLike(pricing.base_amount_idr) };
  bundle.components.forEach((c, i) => {
    scope[`component_${i + 1}`] = { type: "number", value: fromNumberLike(c.customer_price) };
  });
  return scope;
}

export function formulaVariableNames(
  bundle: ProductBundle,
  pricing: ProductPricing,
): { name: string; type: string }[] {
  const names: { name: string; type: string }[] = [{ name: "base", type: "number" }];
  for (const f of bundle.fields) {
    if (!f.is_active || f.field_type === "info_block") continue;
    const type = NUMERIC_FIELD_TYPES.includes(f.field_type)
      ? "number"
      : f.field_type === "boolean"
        ? "boolean"
        : f.field_type === "multi_select"
          ? "list"
          : "string";
    names.push({ name: f.variable_name, type });
  }
  bundle.components.forEach((c, i) => {
    names.push({ name: `component_${i + 1}`, type: `number (${c.internal_name})` });
  });
  void pricing;
  return names;
}

type Token =
  | { k: "num"; v: Exact }
  | { k: "str"; v: string }
  | { k: "name"; v: string }
  | { k: "op"; v: string }
  | { k: "punc"; v: string };

const MAX_EXPRESSION_LENGTH = 2000;
const MAX_DEPTH = 32;

function tokenize(src: string): Token[] {
  if (src.length > MAX_EXPRESSION_LENGTH) throw new PricingError("The formula is too long.");
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/\d/.test(c)) {
      let j = i;
      while (j < src.length && /[\d.]/.test(src[j]!)) j++;
      tokens.push({ k: "num", v: fromNumberLike(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end === -1) throw new PricingError("A text value is not closed.");
      tokens.push({ k: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j]!)) j++;
      tokens.push({ k: "name", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<="].includes(two)) {
      tokens.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/><=".includes(c)) {
      tokens.push({ k: "op", v: c === "=" ? "==" : c });
      i++;
      continue;
    }
    if ("(),".includes(c)) {
      tokens.push({ k: "punc", v: c });
      i++;
      continue;
    }
    throw new PricingError(`"${c}" is not allowed in a formula.`);
  }
  return tokens;
}

export function evaluateFormula(expression: string, scope: PricingInputs): PricingValue {
  const tokens = tokenize(expression);
  let pos = 0;
  let depth = 0;

  const peek = () => tokens[pos];
  const eat = (k: Token["k"], v?: string) => {
    const t = tokens[pos];
    if (!t || t.k !== k || (v != null && t.v !== v)) {
      throw new PricingError(v ? `"${v}" was expected in the formula.` : "The formula is incomplete.");
    }
    pos++;
    return t;
  };

  const num = (v: PricingValue, what: string): Exact => {
    if (v.type !== "number") throw new PricingError(`${what} needs a number, not ${v.type}.`);
    return v.value;
  };

  function primary(): PricingValue {
    if (++depth > MAX_DEPTH) throw new PricingError("The formula is nested too deeply.");
    const t = peek();
    if (!t) throw new PricingError("The formula is incomplete.");

    let result: PricingValue;
    if (t.k === "num") {
      pos++;
      result = { type: "number", value: t.v };
    } else if (t.k === "str") {
      pos++;
      result = { type: "string", value: t.v };
    } else if (t.k === "op" && t.v === "-") {
      pos++;
      result = { type: "number", value: -num(primary(), "A minus sign") };
    } else if (t.k === "punc" && t.v === "(") {
      pos++;
      result = comparison();
      eat("punc", ")");
    } else if (t.k === "name") {
      pos++;
      const name = t.v;
      const upper = name.toUpperCase();
      if (peek()?.k === "punc" && peek()?.v === "(") {
        pos++;
        const args: PricingValue[] = [comparison()];
        while (peek()?.k === "punc" && peek()?.v === ",") {
          pos++;
          args.push(comparison());
        }
        eat("punc", ")");
        result = callFunction(upper, args);
      } else if (upper === "TRUE" || upper === "FALSE") {
        result = { type: "boolean", value: upper === "TRUE" };
      } else {
        const value = scope[name];
        if (!value) throw new PricingError(`"${name}" is not a known value for this product.`);
        result = value;
      }
    } else {
      throw new PricingError("The formula could not be read.");
    }
    depth--;
    return result;
  }

  function callFunction(name: string, args: PricingValue[]): PricingValue {
    if (name === "IF") {
      if (args.length !== 3) throw new PricingError("IF needs three parts.");
      const cond = args[0]!;
      if (cond.type !== "boolean") throw new PricingError("IF needs a yes/no condition.");
      const a = args[1]!;
      const b = args[2]!;
      if (a.type !== b.type) throw new PricingError("Both IF results must be the same kind of value.");
      return cond.value ? a : b;
    }
    if (name === "MIN" || name === "MAX") {
      if (args.length < 2) throw new PricingError(`${name} needs at least two numbers.`);
      const values = args.map((a) => num(a, name));
      const result = values.reduce((acc, v) => (name === "MIN" ? (v < acc ? v : acc) : v > acc ? v : acc));
      return { type: "number", value: result };
    }
    if (name === "CONTAINS") {
      if (args.length !== 2) throw new PricingError("CONTAINS needs a selection and a value.");
      const list = args[0]!;
      const needle = args[1]!;
      if (list.type !== "list" || needle.type !== "string") {
        throw new PricingError("CONTAINS needs a multiple-choice answer and a text value.");
      }
      return { type: "boolean", value: list.value.includes(needle.value) };
    }
    throw new PricingError(`"${name}" is not an allowed function.`);
  }

  function term(): PricingValue {
    let left = primary();
    while (peek()?.k === "op" && ["*", "/"].includes(peek()!.v as string)) {
      const op = (eat("op") as { v: string }).v;
      const right = primary();
      const a = num(left, "Multiplication and division");
      const b = num(right, "Multiplication and division");
      left = { type: "number", value: op === "*" ? exactMul(a, b) : exactDiv(a, b) };
    }
    return left;
  }

  function sum(): PricingValue {
    let left = term();
    while (peek()?.k === "op" && ["+", "-"].includes(peek()!.v as string)) {
      const op = (eat("op") as { v: string }).v;
      const right = term();
      const a = num(left, "Addition and subtraction");
      const b = num(right, "Addition and subtraction");
      left = { type: "number", value: op === "+" ? a + b : a - b };
    }
    return left;
  }

  function comparison(): PricingValue {
    const left = sum();
    const t = peek();
    if (t?.k === "op" && ["==", "!=", ">", "<", ">=", "<="].includes(t.v)) {
      pos++;
      const right = sum();
      if (t.v === "==" || t.v === "!=") {
        if (left.type !== right.type) {
          throw new PricingError("Only values of the same kind can be compared.");
        }
        if (left.type === "list") throw new PricingError("Use CONTAINS to test a multiple-choice answer.");
        const equal =
          left.type === "number" ? left.value === (right as typeof left).value : left.value === right.value;
        return { type: "boolean", value: t.v === "==" ? equal : !equal };
      }
      const a = num(left, "A comparison");
      const b = num(right, "A comparison");
      const value =
        t.v === ">" ? a > b : t.v === "<" ? a < b : t.v === ">=" ? a >= b : a <= b;
      return { type: "boolean", value };
    }
    return left;
  }

  const value = comparison();
  if (pos !== tokens.length) throw new PricingError("The formula has unexpected extra text.");
  return value;
}

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

export type PricingIssue = { level: "error" | "warning"; message: string };

export function validatePricing(args: {
  bundle: ProductBundle;
  pricing: ProductPricing | null;
  rules: PricingRule[];
  tiers: PricingTier[];
  versions: FormulaVersion[];
}): PricingIssue[] {
  const { bundle, pricing, rules, tiers, versions } = args;
  const issues: PricingIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  if (!pricing) {
    err("No pricing is configured for this product.");
    return issues;
  }
  if (Number(pricing.base_amount_idr) < 0) err("The base amount cannot be negative.");

  const numericVariables = new Map(
    bundle.fields
      .filter((f) => f.is_active && NUMERIC_FIELD_TYPES.includes(f.field_type))
      .map((f) => [f.variable_name, f]),
  );
  const allVariables = new Set(
    bundle.fields.filter((f) => f.is_active).map((f) => f.variable_name),
  );

  const mappings: [string, string | null][] = [
    ["people", pricing.people_variable],
    ["days", pricing.days_variable],
    ["nights", pricing.nights_variable],
    ["sessions", pricing.sessions_variable],
  ];
  for (const [name, variable] of mappings) {
    if (variable && !numericVariables.has(variable)) {
      err(`The ${name} quantity is mapped to "${variable}", which is not an active number question.`);
    }
  }

  if (pricing.mode === "structured") {
    const activeRules = rules.filter((r) => r.is_active);
    if (activeRules.length === 0 && Number(pricing.base_amount_idr) === 0) {
      warn("There is no base amount and no active rule, so every price will be zero.");
    }

    for (const rule of activeRules) {
      if (!rule.label.trim()) err("A rule has no name.");
      switch (rule.rule_type) {
        case "fixed":
          if (rule.amount_idr == null) err(`Rule "${rule.label}" has no amount.`);
          break;
        case "variable_times_amount":
          if (rule.amount_idr == null) err(`Rule "${rule.label}" has no amount.`);
          if (!rule.variable_name) err(`Rule "${rule.label}" has no question selected.`);
          else if (!numericVariables.has(rule.variable_name)) {
            err(`Rule "${rule.label}" uses "${rule.variable_name}", which is not an active number question.`);
          }
          break;
        case "component_quantity": {
          const component = bundle.components.find((c) => c.id === rule.component_id);
          if (!component) {
            err(`Rule "${rule.label}" has no component selected.`);
            break;
          }
          if (!component.is_active) warn(`Rule "${rule.label}" uses an inactive component.`);
          if (rule.quantity_variable) {
            if (!numericVariables.has(rule.quantity_variable)) {
              err(
                `Component "${component.internal_name}" takes its quantity from "${rule.quantity_variable}", which is not an active number question.`,
              );
            }
          } else {
            const basis = component.unit_basis;
            const needed =
              basis === "per_person"
                ? pricing.people_variable
                : basis === "per_day"
                  ? pricing.days_variable
                  : basis === "per_night"
                    ? pricing.nights_variable
                    : basis === "per_session"
                      ? pricing.sessions_variable
                      : "fixed";
            if (!needed) {
              err(
                `Component "${component.internal_name}" is priced ${basis.replace("_", " ")}, but no question supplies that quantity.`,
              );
            }
          }
          if (rule.condition_variable) {
            if (!allVariables.has(rule.condition_variable)) {
              err(`Rule "${rule.label}" tests "${rule.condition_variable}", which no longer exists.`);
            }
            if (
              !rule.condition_operator ||
              !PRICING_CONDITION_OPERATORS.some((o) => o.value === rule.condition_operator)
            ) {
              err(`Rule "${rule.label}" has no valid condition.`);
            }
            if (
              ["equals", "not_equals", "greater_than", "less_than"].includes(rule.condition_operator ?? "") &&
              !rule.condition_value?.trim()
            ) {
              err(`Rule "${rule.label}" has no comparison value.`);
            }
          }
          break;
        }
        case "conditional":
          if (rule.amount_idr == null) err(`Rule "${rule.label}" has no amount.`);
          if (!rule.condition_variable) err(`Rule "${rule.label}" has no condition question.`);
          else if (!allVariables.has(rule.condition_variable)) {
            err(`Rule "${rule.label}" tests "${rule.condition_variable}", which no longer exists.`);
          }
          if (
            !rule.condition_operator ||
            !PRICING_CONDITION_OPERATORS.some((o) => o.value === rule.condition_operator)
          ) {
            err(`Rule "${rule.label}" has no valid condition.`);
          }
          if (
            ["equals", "not_equals", "greater_than", "less_than"].includes(rule.condition_operator ?? "") &&
            !rule.condition_value?.trim()
          ) {
            err(`Rule "${rule.label}" has no comparison value.`);
          }
          break;
        case "tier": {
          if (!rule.variable_name || !numericVariables.has(rule.variable_name)) {
            err(`Tier rule "${rule.label}" needs an active number question.`);
          }
          const own = tiers
            .filter((t) => t.rule_id === rule.id)
            .sort((a, b) => Number(a.from_value) - Number(b.from_value));
          if (own.length === 0) {
            err(`Tier rule "${rule.label}" has no tiers.`);
            break;
          }
          for (const t of own) {
            if (t.to_value != null && Number(t.to_value) < Number(t.from_value)) {
              err(`Tier rule "${rule.label}" has a tier ending before it starts.`);
            }
          }
          for (let i = 1; i < own.length; i++) {
            const previous = own[i - 1]!;
            const current = own[i]!;
            if (previous.to_value == null) {
              err(`Tier rule "${rule.label}" has an open-ended tier before its last tier.`);
              break;
            }
            if (Number(current.from_value) <= Number(previous.to_value)) {
              err(`Tier rule "${rule.label}" has overlapping tiers.`);
            } else if (Number(current.from_value) > Number(previous.to_value) + 1) {
              warn(`Tier rule "${rule.label}" leaves a gap between tiers.`);
            }
          }
          break;
        }
      }
    }
  } else {
    const active = versions.find((v) => v.is_active);
    if (!active) {
      err("This product prices with a formula, but no formula version is active.");
    } else {
      const scopeNames = new Set(formulaVariableNames(bundle, pricing).map((v) => v.name));
      const probe: PricingInputs = {};
      for (const f of bundle.fields) {
        if (!f.is_active || f.field_type === "info_block") continue;
        probe[f.variable_name] = NUMERIC_FIELD_TYPES.includes(f.field_type)
          ? { type: "number", value: fromNumberLike(1) }
          : f.field_type === "boolean"
            ? { type: "boolean", value: true }
            : f.field_type === "multi_select"
              ? { type: "list", value: [] }
              : { type: "string", value: "" };
      }
      probe["base"] = { type: "number", value: fromNumberLike(pricing.base_amount_idr) };
      bundle.components.forEach((c, i) => {
        probe[`component_${i + 1}`] = { type: "number", value: fromNumberLike(c.customer_price) };
      });
      void scopeNames;
      try {
        const result = evaluateFormula(active.expression, probe);
        if (result.type !== "number") err("The formula must produce a number.");
      } catch (e) {
        err(e instanceof Error ? e.message : "The formula is not valid.");
      }
    }
  }

  return issues;
}

/** A product is only purchasable when both the product and its pricing are active. */
export function isPurchasable(productStatus: string, pricingStatus: string | null | undefined) {
  return productStatus === "active" && pricingStatus === "active";
}

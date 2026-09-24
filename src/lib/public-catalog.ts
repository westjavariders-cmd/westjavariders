/**
 * Pure helpers for the public (customer-facing) layer.
 * No pricing logic lives here: prices always come from the server quote.
 */
import type { Field, FieldOption, PreviewValues } from "@/lib/catalog";

export function formatIdr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("en-US")}`;
}

/**
 * Editorial title for the public funnel (card, landing, configure, summary).
 * Does not use voucher_name — that override is only for cart, order and voucher.
 */
export function getPublicProductTitle(
  translationTitle: string | null | undefined,
  internalName: string | null | undefined,
): string {
  const editorial = translationTitle?.trim() ?? "";
  if (editorial) return editorial;
  return internalName?.trim() ?? "";
}

export type AnswerSummaryLine = { label: string; value: string };

export type SummarizeAnswersOptions = {
  /**
   * Voucher default (`omit`): yes/no is only a gate, so it is left out.
   * Configurator (`yes_no`): show an explicit Yes/No for a real boolean answer.
   */
  booleanValues?: "omit" | "yes_no";
  /**
   * Field id → the question the customer saw (step Customer-facing title).
   * Falls back to the field's customer_label, then its internal name.
   */
  questionTitles?: Record<string, string>;
};

/** Calendar YYYY-MM-DD as a readable date. Does not apply a timezone. */
export function formatCalendarDate(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!match) return raw;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  const month = months[Number(match[2]) - 1];
  if (!month) return raw;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quantities that travel with a choice instead of being their own question. */
export const QUANTITY_SUFFIXES: { suffix: string; label: string }[] = [
  { suffix: "_people", label: "People" },
  { suffix: "_hours", label: "Hours" },
  { suffix: "_days", label: "Days" },
  { suffix: "_nights", label: "Nights" },
];

/** True when the answer means "the customer did not take this". */
export function isEmptyAnswer(raw: unknown): boolean {
  return raw == null || raw === "" || raw === false || (Array.isArray(raw) && raw.length === 0);
}

function quantityLines(
  variable: string,
  answers: Record<string, unknown>,
  labels: Record<string, string> = {},
): AnswerSummaryLine[] {
  const out: AnswerSummaryLine[] = [];
  for (const { suffix, label } of QUANTITY_SUFFIXES) {
    const raw = answers[`${variable}${suffix}`];
    if (isEmptyAnswer(raw)) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n <= 0) continue;
    out.push({ label: labels[suffix] || label, value: String(raw) });
  }
  return out;
}

/**
 * Human-readable summary of a saved configuration, using customer labels only.
 * Only what the customer actually chose is listed: unanswered questions and
 * declined extras ("No") are left out, so the voucher shows their trip and not
 * the whole questionnaire. Catalogue-fed choices always read as the item name,
 * never as an internal id, and the quantities that belong to a choice
 * (people, hours, days, nights) follow it as their own lines.
 */
export function summarizeAnswers(
  fields: Pick<
    Field,
    "id" | "variable_name" | "customer_label" | "internal_name" | "field_type" | "is_active"
  >[],
  options: Pick<FieldOption, "field_id" | "internal_value" | "customer_label">[],
  answers: PreviewValues,
  /** Catalogue item id → public name, for questions fed by a catalogue. */
  catalogueNames: Record<string, string> = {},
  /** Question variable → quantity suffix → catalogue-specific customer label. */
  quantityLabels: Record<string, Record<string, string>> = {},
  extras: SummarizeAnswersOptions = {},
): AnswerSummaryLine[] {
  const all = (answers ?? {}) as Record<string, unknown>;
  const lines: AnswerSummaryLine[] = [];
  for (const f of fields) {
    if (!f.is_active || f.field_type === "info_block") continue;
    const raw = all[f.variable_name];
    const isBoolean = typeof raw === "boolean" || f.field_type === "boolean";
    const titled = extras.questionTitles?.[f.id]?.trim();
    const label = titled || f.customer_label?.trim() || f.internal_name;

    if (extras.booleanValues === "yes_no" && isBoolean && (raw === true || raw === false)) {
      lines.push({ label, value: raw === true ? "Yes" : "No" });
      lines.push(...quantityLines(f.variable_name, all, quantityLabels[f.variable_name]));
      continue;
    }

    if (isEmptyAnswer(raw)) continue;

    // Unresolvable ids are dropped instead of leaking an internal code.
    const optionLabel = (value: string): string | null => {
      const o = options.find((x) => x.field_id === f.id && x.internal_value === value);
      if (o?.customer_label) return o.customer_label;
      const name = catalogueNames[value];
      if (name) return name;
      return UUID_RE.test(value) ? null : value;
    };

    // Yes/no questions are only gates for what follows: the chosen extras and
    // their quantities are listed on their own, so the "Yes" itself is noise.
    if (isBoolean) {
      lines.push(...quantityLines(f.variable_name, all, quantityLabels[f.variable_name]));
      continue;
    }

    let value: string | null;
    if (Array.isArray(raw)) {
      const parts = raw.map((v) => optionLabel(String(v))).filter((v): v is string => !!v);
      value = parts.length > 0 ? parts.join(", ") : null;
    } else if (f.field_type === "single_select" || f.field_type === "multi_select")
      value = optionLabel(String(raw));
    else if (f.field_type === "date" || f.field_type === "date_range")
      value = formatCalendarDate(String(raw));
    else value = String(raw);

    if (value == null || value === "") continue;
    lines.push({ label, value });
    lines.push(...quantityLines(f.variable_name, all, quantityLabels[f.variable_name]));
  }
  return lines;
}

/** Payable total: only completed packages count. */
export function payableTotal(packages: { status: string; total_idr: number }[]): number {
  return packages
    .filter((p) => p.status === "complete")
    .reduce((sum, p) => sum + Number(p.total_idr), 0);
}

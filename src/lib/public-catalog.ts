/**
 * Pure helpers for the public (customer-facing) layer.
 * No pricing logic lives here: prices always come from the server quote.
 */
import type { Field, FieldOption, PreviewValues } from "@/lib/catalog";

export function formatIdr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("en-US")}`;
}

export type AnswerSummaryLine = { label: string; value: string };

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
  return (
    raw == null ||
    raw === "" ||
    raw === false ||
    (Array.isArray(raw) && raw.length === 0)
  );
}

function quantityLines(
  variable: string,
  answers: Record<string, unknown>,
): AnswerSummaryLine[] {
  const out: AnswerSummaryLine[] = [];
  for (const { suffix, label } of QUANTITY_SUFFIXES) {
    const raw = answers[`${variable}${suffix}`];
    if (isEmptyAnswer(raw)) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n <= 0) continue;
    out.push({ label, value: String(raw) });
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
  fields: Pick<Field, "id" | "variable_name" | "customer_label" | "internal_name" | "field_type" | "is_active">[],
  options: Pick<FieldOption, "field_id" | "internal_value" | "customer_label">[],
  answers: PreviewValues,
  /** Catalogue item id → public name, for questions fed by a catalogue. */
  catalogueNames: Record<string, string> = {},
): AnswerSummaryLine[] {
  const all = (answers ?? {}) as Record<string, unknown>;
  const lines: AnswerSummaryLine[] = [];
  for (const f of fields) {
    if (!f.is_active || f.field_type === "info_block") continue;
    const raw = all[f.variable_name];
    if (isEmptyAnswer(raw)) continue;

    const label = f.customer_label || f.internal_name;
    // Unresolvable ids are dropped instead of leaking an internal code.
    const optionLabel = (value: string): string | null => {
      const o = options.find((x) => x.field_id === f.id && x.internal_value === value);
      if (o?.customer_label) return o.customer_label;
      const name = catalogueNames[value];
      if (name) return name;
      return UUID_RE.test(value) ? null : value;
    };

    let value: string | null;
    if (Array.isArray(raw)) {
      const parts = raw.map((v) => optionLabel(String(v))).filter((v): v is string => !!v);
      value = parts.length > 0 ? parts.join(", ") : null;
    } else if (typeof raw === "boolean") value = "Yes";
    else if (f.field_type === "single_select" || f.field_type === "multi_select")
      value = optionLabel(String(raw));
    else value = String(raw);

    if (value == null || value === "") continue;
    lines.push({ label, value });
    lines.push(...quantityLines(f.variable_name, all));
  }
  return lines;
}


/** Payable total: only completed packages count. */
export function payableTotal(packages: { status: string; total_idr: number }[]): number {
  return packages
    .filter((p) => p.status === "complete")
    .reduce((sum, p) => sum + Number(p.total_idr), 0);
}

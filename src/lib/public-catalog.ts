/**
 * Pure helpers for the public (customer-facing) layer.
 * No pricing logic lives here: prices always come from the server quote.
 */
import type { Field, FieldOption, PreviewValues } from "@/lib/catalog";

export function formatIdr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("en-US")}`;
}

export type AnswerSummaryLine = { label: string; value: string };

/** Human-readable summary of a saved configuration, using customer labels only. */
export function summarizeAnswers(
  fields: Pick<Field, "id" | "variable_name" | "customer_label" | "internal_name" | "field_type" | "is_active">[],
  options: Pick<FieldOption, "field_id" | "internal_value" | "customer_label">[],
  answers: PreviewValues,
  /** Catalogue item id → public name, for questions fed by a catalogue. */
  catalogueNames: Record<string, string> = {},
): AnswerSummaryLine[] {
  const lines: AnswerSummaryLine[] = [];
  for (const f of fields) {
    if (!f.is_active || f.field_type === "info_block") continue;
    const raw = answers[f.variable_name];
    if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;

    const label = f.customer_label || f.internal_name;
    const optionLabel = (value: string) => {
      const o = options.find((x) => x.field_id === f.id && x.internal_value === value);
      return o?.customer_label ?? value;
    };

    let value: string;
    if (Array.isArray(raw)) value = raw.map(optionLabel).join(", ");
    else if (typeof raw === "boolean") value = raw ? "Yes" : "No";
    else if (f.field_type === "single_select") value = optionLabel(String(raw));
    else value = String(raw);

    lines.push({ label, value });
  }
  return lines;
}

/** Payable total: only completed packages count. */
export function payableTotal(packages: { status: string; total_idr: number }[]): number {
  return packages
    .filter((p) => p.status === "complete")
    .reduce((sum, p) => sum + Number(p.total_idr), 0);
}

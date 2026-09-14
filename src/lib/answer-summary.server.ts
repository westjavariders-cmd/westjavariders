import { sortFieldsByStepOrder } from "@/lib/purchase";
import {
  QUANTITY_SUFFIXES,
  isEmptyAnswer,
  summarizeAnswers,
  type AnswerSummaryLine,
} from "@/lib/public-catalog";

/**
 * Builds one customer-facing answer list in the exact order of the product's
 * configurator. It also maps renamed legacy catalogue variables by catalogue,
 * without changing the historical answers stored in the purchase snapshot.
 */
async function orderedAnswerDetails(
  db: any,
  productId: string,
  answersInput: Record<string, unknown> | null | undefined,
  catalogueSelections: any[] = [],
): Promise<{ lines: AnswerSummaryLine[]; fields: any[]; answers: Record<string, unknown> }> {
  const answers = { ...(answersInput ?? {}) };
  const [{ data: flow }, { data: fieldRows }] = await Promise.all([
    db.from("config_flows").select("id").eq("product_id", productId).maybeSingle(),
    db.from("fields").select("*").eq("product_id", productId).order("display_order"),
  ]);
  const fields = fieldRows ?? [];
  const { data: steps } = flow
    ? await db.from("steps").select("id, display_order").eq("flow_id", flow.id).order("display_order")
    : { data: [] };
  const orderedFields = sortFieldsByStepOrder(fields as any[], (steps ?? []) as any[]);
  const fieldIds = fields.map((field: any) => field.id);
  const options = fieldIds.length
    ? ((await db.from("field_options").select("*").in("field_id", fieldIds).order("display_order")).data ?? [])
    : [];

  // Older snapshots can retain the original variable name after the current
  // catalogue question was renamed. Match it by its stable catalogue source.
  for (const selection of catalogueSelections ?? []) {
    const oldVariable = String(selection?.variable_name ?? "");
    if (!oldVariable || isEmptyAnswer(answers[oldVariable])) continue;
    const matching = fields.find(
      (field: any) =>
        field.option_source === "catalogue" &&
        field.catalogue_type === selection?.catalogue_type &&
        (!selection?.catalogue_id || field.catalogue_id === selection.catalogue_id),
    );
    if (!matching || !isEmptyAnswer(answers[matching.variable_name])) continue;
    answers[matching.variable_name] = answers[oldVariable];
    for (const { suffix } of QUANTITY_SUFFIXES) {
      const oldQuantity = answers[`${oldVariable}${suffix}`];
      if (!isEmptyAnswer(oldQuantity)) answers[`${matching.variable_name}${suffix}`] = oldQuantity;
    }
  }

  const lines = summarizeAnswers(
    orderedFields as never,
    options as never,
    answers as never,
    Object.fromEntries(
      (catalogueSelections ?? [])
        .filter((selection: any) => selection?.item_id && selection?.name)
        .map((selection: any) => [selection.item_id, selection.name]),
    ),
  );
  return { lines, fields, answers };
}

export async function orderedAnswerSummary(
  db: any,
  productId: string,
  answersInput: Record<string, unknown> | null | undefined,
  catalogueSelections: any[] = [],
): Promise<AnswerSummaryLine[]> {
  return (await orderedAnswerDetails(db, productId, answersInput, catalogueSelections)).lines;
}

/** Adds ordered labels in memory only; the immutable purchase snapshot is untouched. */
export async function withOrderedSnapshotAnswers(db: any, snapshot: any): Promise<any> {
  if (!snapshot || !Array.isArray(snapshot.packages)) return snapshot;
  return {
    ...snapshot,
    packages: await Promise.all(
      snapshot.packages.map(async (pkg: any) => {
        if (!pkg?.product_id) return pkg;
        const details = await orderedAnswerDetails(
          db,
          String(pkg.product_id),
          pkg.answers,
          pkg.catalogue_selections,
        );
        const ordered = [...details.lines];
        const seen = new Set(ordered.map((line) => `${line.label}\u0000${line.value}`));

        // Keep a historical question that no longer exists, but place it last.
        for (const line of Array.isArray(pkg.option_labels) ? pkg.option_labels : []) {
          if (!line || line.label == null || line.value == null) continue;
          const saved = { label: String(line.label), value: String(line.value) };
          const key = `${saved.label}\u0000${saved.value}`;
          if (!seen.has(key)) {
            ordered.push(saved);
            seen.add(key);
          }
        }

        const currentVariables = new Set(details.fields.map((field: any) => field.variable_name));
        const names = Object.fromEntries(
          (pkg.catalogue_selections ?? []).map((selection: any) => [selection.item_id, selection.name]),
        );
        for (const [key, raw] of Object.entries((pkg.answers ?? {}) as Record<string, unknown>)) {
          if (currentVariables.has(key) || QUANTITY_SUFFIXES.some(({ suffix }) => key.endsWith(suffix))) continue;
          if (isEmptyAnswer(raw) || typeof raw === "boolean") continue;
          const values = (Array.isArray(raw) ? raw : [raw])
            .map((value) => names[String(value)] ?? String(value))
            .filter((value) => !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value));
          if (values.length === 0) continue;
          const line = {
            label: key.replace(/_/g, " ").replace(/^\w/, (character) => character.toUpperCase()),
            value: values.join(", "),
          };
          const lineKey = `${line.label}\u0000${line.value}`;
          if (!seen.has(lineKey)) ordered.push(line);
        }
        return {
          ...pkg,
          option_labels: ordered,
        };
      }),
    ),
  };
}
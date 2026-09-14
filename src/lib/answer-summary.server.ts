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
export async function orderedAnswerSummary(
  db: any,
  productId: string,
  answersInput: Record<string, unknown> | null | undefined,
  catalogueSelections: any[] = [],
): Promise<AnswerSummaryLine[]> {
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

  return summarizeAnswers(
    orderedFields as never,
    options as never,
    answers as never,
    Object.fromEntries(
      (catalogueSelections ?? [])
        .filter((selection: any) => selection?.item_id && selection?.name)
        .map((selection: any) => [selection.item_id, selection.name]),
    ),
  );
}

/** Adds ordered labels in memory only; the immutable purchase snapshot is untouched. */
export async function withOrderedSnapshotAnswers(db: any, snapshot: any): Promise<any> {
  if (!snapshot || !Array.isArray(snapshot.packages)) return snapshot;
  return {
    ...snapshot,
    packages: await Promise.all(
      snapshot.packages.map(async (pkg: any) => {
        if (!pkg?.product_id) return pkg;
        return {
          ...pkg,
          option_labels: await orderedAnswerSummary(
            db,
            String(pkg.product_id),
            pkg.answers,
            pkg.catalogue_selections,
          ),
        };
      }),
    ),
  };
}
/**
 * Generic Catalogue Bridge — pure layer.
 *
 * A configurator field either uses MANUAL options (the existing Phase 3
 * behaviour) or CATALOGUE options resolved from an existing catalogue. This
 * file owns the small shared contract only: it never reads the database and it
 * never calculates a price. Pricing stays in the existing pricing engine.
 *
 * There can be many catalogues per template (`catalogues.template`), so a
 * catalogue-backed field points at ONE catalogue id. Older fields that only
 * name a template keep working: the template itself is then the key.
 */

/** Structural templates a catalogue can be built from. */
export const CATALOGUE_TYPES = ["accommodation_room", "transport", "motorbike"] as const;
export type CatalogueType = (typeof CATALOGUE_TYPES)[number];

export const CATALOGUE_TYPE_LABELS: Record<CatalogueType, string> = {
  accommodation_room: "Accommodation room",
  transport: "Transport",
  motorbike: "Motorbike",
};

export const OPTION_SOURCES = ["manual", "catalogue"] as const;
export type OptionSource = (typeof OPTION_SOURCES)[number];

/** The only shape the configurator ever sees. Customer-safe by construction. */
export type CatalogueItem = {
  catalogue_type: CatalogueType;
  /** The catalogue this item belongs to, when the catalogue is known. */
  catalogue_id?: string | null;
  id: string;
  name: string;
  reference: string | null;
  description: string | null;
  photo_url: string | null;
  /** Customer-facing price in whole IDR, when the catalogue defines one. */
  customer_price_idr: number | null;
};

/** One catalogue a field reads from: a template, optionally a single catalogue. */
export type CatalogueRef = { catalogue_type: CatalogueType; catalogue_id: string | null };

/**
 * Stable lookup key for resolved items. A specific catalogue keys by its id;
 * a legacy template-only field keys by the template name.
 */
export function catalogueKey(ref: CatalogueRef): string {
  return ref.catalogue_id ?? ref.catalogue_type;
}

/** Resolved items grouped by `catalogueKey`. */
export type CatalogueItemsByKey = Partial<Record<string, CatalogueItem[]>>;

/** Keys that must never cross the bridge, whatever a catalogue table holds. */
export const FORBIDDEN_CATALOGUE_KEYS = [
  "supplier_cost_idr",
  "supplier_cost_per_night_idr",
  "supplier_contact",
  "internal_notes",
  "internal_name",
] as const;

/** Defensive projection: only the contract fields ever leave the server. */
export function toCatalogueItem(type: CatalogueType, row: Record<string, unknown>): CatalogueItem {
  const price = row["customer_price_idr"];
  return {
    catalogue_type: type,
    catalogue_id: (row["catalogue_id"] as string | null) ?? null,
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    reference: (row["reference"] as string | null) ?? null,
    description: (row["description"] as string | null) ?? null,
    photo_url: (row["photo_url"] as string | null) ?? null,
    customer_price_idr: price == null ? null : Number(price),
  };
}

export type FieldSourceConfig = {
  id: string;
  variable_name: string;
  field_type: string;
  option_source?: string | null;
  catalogue_type?: string | null;
  catalogue_id?: string | null;
};

export function isCatalogueField(field: FieldSourceConfig): boolean {
  return field.option_source === "catalogue" && !!field.catalogue_type;
}

export function fieldCatalogueType(field: FieldSourceConfig): CatalogueType | null {
  return isCatalogueField(field) ? (field.catalogue_type as CatalogueType) : null;
}

/** The catalogue one field reads from, or null when it uses manual options. */
export function fieldCatalogueRef(field: FieldSourceConfig): CatalogueRef | null {
  const type = fieldCatalogueType(field);
  if (!type) return null;
  return { catalogue_type: type, catalogue_id: field.catalogue_id ?? null };
}

/** Lookup key for one field's resolved items. */
export function fieldCatalogueKey(field: FieldSourceConfig): string | null {
  const ref = fieldCatalogueRef(field);
  return ref ? catalogueKey(ref) : null;
}

/** Every catalogue the given fields read from, once each. */
export function fieldCatalogueRefs(fields: FieldSourceConfig[]): CatalogueRef[] {
  const out: CatalogueRef[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    const ref = fieldCatalogueRef(field);
    if (!ref) continue;
    const key = catalogueKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/**
 * Extra pricing variable exposed for a catalogue field: `<variable>_price`.
 * This is the whole integration point with the pricing engine — the engine
 * decides what to do with it (× nights, × quantity, fixed, or nothing).
 */
export function cataloguePriceVariable(variableName: string): string {
  return `${variableName}_price`;
}

/** One selected catalogue item, stored on the package for historical integrity. */
export type CatalogueSelection = {
  variable_name: string;
  catalogue_type: CatalogueType;
  /** The catalogue the item came from, when the field names one. */
  catalogue_id?: string | null;
  item_id: string;
  name: string;
  reference: string | null;
  customer_price_idr: number | null;
};

function selectedIds(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map(String).filter((v) => v !== "");
  return [String(raw)];
}

/**
 * Matches the customer's answers against the resolved active items.
 * Invalid or no-longer-active selections are reported, never replaced.
 */
export function resolveCatalogueSelections(
  fields: FieldSourceConfig[],
  answers: Record<string, unknown>,
  itemsByKey: CatalogueItemsByKey,
  labelOf: (field: FieldSourceConfig) => string = (f) => f.variable_name,
): { selections: CatalogueSelection[]; invalid: string[] } {
  const selections: CatalogueSelection[] = [];
  const invalid: string[] = [];

  for (const field of fields) {
    const ref = fieldCatalogueRef(field);
    if (!ref) continue;
    const available = itemsByKey[catalogueKey(ref)] ?? [];
    for (const id of selectedIds(answers[field.variable_name])) {
      const item = available.find((i) => i.id === id);
      if (!item) {
        invalid.push(`Your choice for ${labelOf(field)} is no longer available. Please choose again.`);
        continue;
      }
      selections.push({
        variable_name: field.variable_name,
        catalogue_type: ref.catalogue_type,
        catalogue_id: item.catalogue_id ?? ref.catalogue_id ?? null,
        item_id: item.id,
        name: item.name,
        reference: item.reference,
        customer_price_idr: item.customer_price_idr,
      });
    }
  }
  return { selections, invalid };
}

/** Removes selections that no longer resolve, so the answer is re-asked. */
export function stripInvalidCatalogueAnswers(
  fields: FieldSourceConfig[],
  answers: Record<string, unknown>,
  itemsByKey: CatalogueItemsByKey,
): Record<string, unknown> {
  const next = { ...answers };
  for (const field of fields) {
    const key = fieldCatalogueKey(field);
    if (!key) continue;
    const ids = new Set((itemsByKey[key] ?? []).map((i) => i.id));
    const raw = next[field.variable_name];
    if (Array.isArray(raw)) next[field.variable_name] = raw.map(String).filter((v) => ids.has(v));
    else if (raw != null && raw !== "" && !ids.has(String(raw))) next[field.variable_name] = "";
  }
  return next;
}

/**
 * Numeric price variables derived from the selections, for the pricing engine.
 * Multiple selections on one field sum their catalogue prices.
 */
export function cataloguePriceVariables(selections: CatalogueSelection[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of selections) {
    if (s.customer_price_idr == null) continue;
    const key = cataloguePriceVariable(s.variable_name);
    out[key] = (out[key] ?? 0) + s.customer_price_idr;
  }
  return out;
}

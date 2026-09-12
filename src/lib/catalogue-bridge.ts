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

/**
 * Extra customer choices an item may require before it has a price, such as a
 * transport item priced by number of people and by travel time. The labels are
 * the catalogue's own customer-facing wording, never the template's.
 */
export type CatalogueChoice = { value: number; price_idr: number };
export type CatalogueCalcMode = "sum" | "multiply";
export type CatalogueVariants = {
  people_label: string;
  hours_label: string;
  people: CatalogueChoice[];
  hours: CatalogueChoice[];
  /** How both prices combine: added together, or multiplied. Defaults to sum. */
  calc_mode?: CatalogueCalcMode;
};


export const DEFAULT_PEOPLE_LABEL = "Number of people";
export const DEFAULT_HOURS_LABEL = "Travel time (hours)";

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
  /** Present when the item is priced by additional customer choices. */
  variants?: CatalogueVariants | null;
};

/** Answer keys the extra choices of one catalogue question are stored under. */
export function cataloguePeopleVariable(variableName: string): string {
  return `${variableName}_people`;
}
export function catalogueHoursVariable(variableName: string): string {
  return `${variableName}_hours`;
}

function toNumberOrNull(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Customer price of one item given its extra choices. Transport combines the
 * people price and the travel-time price exactly like the Admin calculator:
 * added together, or multiplied when the item is configured that way.
 * A missing required choice has no price at all — it is never guessed.
 */
export function catalogueItemPriceIdr(
  item: CatalogueItem,
  people: number | null,
  hours: number | null,
): number | null {
  const v = item.variants;
  if (!v) return item.customer_price_idr;
  const p = people == null ? undefined : v.people.find((x) => x.value === people);
  const h = hours == null ? undefined : v.hours.find((x) => x.value === hours);
  if (v.people.length > 0 && !p) return null;
  if (v.hours.length > 0 && !h) return null;
  if (v.calc_mode === "multiply" && p && h) return p.price_idr * h.price_idr;
  return (p?.price_idr ?? 0) + (h?.price_idr ?? 0);
}




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
    variants: (row["variants"] as CatalogueVariants | null) ?? null,
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
  /** Extra choices the item is priced by, when it has any. */
  people?: number | null;
  travel_hours?: number | null;
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
    const people = toNumberOrNull(answers[cataloguePeopleVariable(field.variable_name)]);
    const hours = toNumberOrNull(answers[catalogueHoursVariable(field.variable_name)]);
    for (const id of selectedIds(answers[field.variable_name])) {
      const item = available.find((i) => i.id === id);
      if (!item) {
        invalid.push(`Your choice for ${labelOf(field)} is no longer available. Please choose again.`);
        continue;
      }
      const price = catalogueItemPriceIdr(item, people, hours);
      if (item.variants && price == null) {
        const missing = [
          item.variants.people.length > 0 && people == null ? item.variants.people_label : null,
          item.variants.hours.length > 0 && hours == null ? item.variants.hours_label : null,
        ].filter(Boolean);
        invalid.push(
          missing.length > 0
            ? `Please choose ${missing.join(" and ")} for ${labelOf(field)}.`
            : `Your choice for ${labelOf(field)} is not available. Please choose again.`,
        );
      }
      selections.push({
        variable_name: field.variable_name,
        catalogue_type: ref.catalogue_type,
        catalogue_id: item.catalogue_id ?? ref.catalogue_id ?? null,
        item_id: item.id,
        name: item.name,
        reference: item.reference,
        customer_price_idr: price,
        ...(item.variants ? { people, travel_hours: hours } : {}),
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
    const items = itemsByKey[key] ?? [];
    const ids = new Set(items.map((i) => i.id));
    const raw = next[field.variable_name];
    if (Array.isArray(raw)) next[field.variable_name] = raw.map(String).filter((v) => ids.has(v));
    else if (raw != null && raw !== "" && !ids.has(String(raw))) next[field.variable_name] = "";

    // Extra choices only survive while they exist for the selected item.
    const chosen = items.find((i) => i.id === String(next[field.variable_name] ?? ""));
    const variants = chosen?.variants ?? null;
    for (const [name, list] of [
      [cataloguePeopleVariable(field.variable_name), variants?.people ?? []],
      [catalogueHoursVariable(field.variable_name), variants?.hours ?? []],
    ] as const) {
      const value = toNumberOrNull(next[name]);
      if (value == null) continue;
      if (!list.some((c) => c.value === value)) next[name] = "";
    }
  }
  return next;
}

/**
 * Numeric price variables derived from the selections, for the pricing engine.
 * Multiple selections on one field sum their catalogue prices. The extra
 * choices are exposed too, so a formula can use people or hours directly.
 */
export function cataloguePriceVariables(selections: CatalogueSelection[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of selections) {
    if (s.customer_price_idr != null) {
      const key = cataloguePriceVariable(s.variable_name);
      out[key] = (out[key] ?? 0) + s.customer_price_idr;
    }
    if (s.people != null) out[cataloguePeopleVariable(s.variable_name)] = s.people;
    if (s.travel_hours != null) out[catalogueHoursVariable(s.variable_name)] = s.travel_hours;
  }
  return out;

}

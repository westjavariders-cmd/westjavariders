/**
 * Whole-site automatic translation — server-only.
 *
 * Collects every customer-facing text (website pages, menu, entry screen,
 * experiences, configurator questions, catalogues and the fixed interface
 * strings), translates what is missing with Lovable AI and stores the result in
 * the existing translation tables plus `text_translations`.
 *
 * Manual edits win: an already filled translation is only replaced when
 * `overwrite` is set.
 */
import { UI_STRINGS } from "@/lib/ui-strings";
import { upsertText, type TextScope } from "@/lib/text-translations.server";

export type TranslationScope = "website" | "products" | "catalogues" | "ui";

type Lang = { code: string; name: string };

/** One text to translate, plus where it has to be written back. */
type Cell = {
  key: string;
  text: string;
  write: (value: string) => Promise<void>;
};

const BATCH = 30;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function upsertTranslationRow(
  db: any,
  table: string,
  column: string,
  id: string,
  language: string,
  values: Record<string, string | null>,
) {
  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq(column, id)
    .eq("language_code", language)
    .maybeSingle();
  if (existing?.id) {
    await db.from(table).update(values).eq("id", existing.id);
    return;
  }
  await db.from(table).insert({ [column]: id, language_code: language, ...values });
}

/** Writes one column of a website translation row without losing the others. */
function websiteCell(
  db: any,
  table: string,
  column: string,
  id: string,
  language: string,
  field: string,
): (value: string) => Promise<void> {
  return async (value: string) => {
    await upsertTranslationRow(db, table, column, id, language, { [field]: value });
  };
}

function textCell(
  db: any,
  scope: TextScope,
  ref: string,
  field: string,
  language: string,
): (value: string) => Promise<void> {
  return async (value: string) => {
    await upsertText(db, scope, ref, field, language, value);
  };
}

/* ------------------------------------------------------------------ */
/* Collectors                                                         */
/* ------------------------------------------------------------------ */

async function collectWebsite(db: any, master: Lang, target: Lang, overwrite: boolean): Promise<Cell[]> {
  const cells: Cell[] = [];
  const add = (
    source: unknown,
    current: unknown,
    key: string,
    write: (value: string) => Promise<void>,
  ) => {
    const text = trimmed(source);
    if (text === "") return;
    if (!overwrite && trimmed(current) !== "") return;
    cells.push({ key, text, write });
  };

  const byId = (rows: any[] | null | undefined, column: string) => {
    const map = new Map<string, any>();
    for (const row of rows ?? []) map.set(String(row[column]), row);
    return map;
  };

  const [pages, sections, blocks, navItems, landing] = await Promise.all([
    db.from("website_pages").select("id"),
    db.from("website_sections").select("id"),
    db.from("website_blocks").select("id"),
    db.from("website_nav_items").select("id"),
    db.from("website_landing").select("id"),
  ]);

  const groups: {
    table: string;
    column: string;
    fields: string[];
    ids: string[];
  }[] = [
    {
      table: "website_page_translations",
      column: "page_id",
      fields: ["title", "subtitle"],
      ids: (pages.data ?? []).map((r: any) => String(r.id)),
    },
    {
      table: "website_section_translations",
      column: "section_id",
      fields: ["title", "subtitle"],
      ids: (sections.data ?? []).map((r: any) => String(r.id)),
    },
    {
      table: "website_block_translations",
      column: "block_id",
      fields: ["title", "body", "cta_label"],
      ids: (blocks.data ?? []).map((r: any) => String(r.id)),
    },
    {
      table: "website_nav_item_translations",
      column: "nav_item_id",
      fields: ["label"],
      ids: (navItems.data ?? []).map((r: any) => String(r.id)),
    },
    {
      table: "website_landing_translations",
      column: "landing_id",
      fields: ["title", "subtitle", "cta_label"],
      ids: (landing.data ?? []).map((r: any) => String(r.id)),
    },
  ];

  for (const group of groups) {
    if (group.ids.length === 0) continue;
    const select = [group.column, ...group.fields].join(", ");
    const [masterRows, targetRows] = await Promise.all([
      db.from(group.table).select(select).in(group.column, group.ids).eq("language_code", master.code),
      db.from(group.table).select(select).in(group.column, group.ids).eq("language_code", target.code),
    ]);
    const masterMap = byId(masterRows.data as any[], group.column);
    const targetMap = byId(targetRows.data as any[], group.column);
    for (const id of group.ids) {
      const src = masterMap.get(id);
      const cur = targetMap.get(id);
      for (const field of group.fields) {
        add(
          src?.[field],
          cur?.[field],
          `${group.table}:${id}:${field}`,
          websiteCell(db, group.table, group.column, id, target.code, field),
        );
      }
    }
  }

  return cells;
}

/** Existing translations of one scope, as `ref::field -> value`. */
async function existingTexts(db: any, scope: TextScope, language: string) {
  const { data } = await db
    .from("text_translations")
    .select("ref, field, value")
    .eq("scope", scope)
    .eq("language_code", language);
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(`${row.ref}::${row.field}`, trimmed(row.value));
  return map;
}

async function collectProducts(db: any, target: Lang, overwrite: boolean): Promise<Cell[]> {
  const cells: Cell[] = [];
  const add = async (
    scope: TextScope,
    ref: string,
    field: string,
    source: unknown,
    existing: Map<string, string>,
  ) => {
    const text = trimmed(source);
    if (text === "") return;
    if (!overwrite && (existing.get(`${ref}::${field}`) ?? "") !== "") return;
    cells.push({
      key: `${scope}:${ref}:${field}`,
      text,
      write: textCell(db, scope, ref, field, target.code),
    });
  };

  const [products, flows, steps, fields, options] = await Promise.all([
    db.from("products").select("id"),
    db.from("config_flows").select("id"),
    db.from("steps").select("id, customer_title, customer_description"),
    db.from("fields").select("id, customer_label, help_text"),
    db.from("field_options").select("id, customer_label, description"),
  ]);
  void flows;

  const productIds = (products.data ?? []).map((p: any) => String(p.id));
  const [productExisting, stepExisting, fieldExisting, optionExisting] = await Promise.all([
    existingTexts(db, "product", target.code),
    existingTexts(db, "step", target.code),
    existingTexts(db, "field", target.code),
    existingTexts(db, "field_option", target.code),
  ]);

  if (productIds.length > 0) {
    const { data: masterRows } = await db
      .from("product_translations")
      .select("product_id, title, summary, body")
      .in("product_id", productIds)
      .eq("language_code", "en");
    for (const row of masterRows ?? []) {
      const ref = String(row.product_id);
      await add("product", ref, "title", row.title, productExisting);
      await add("product", ref, "summary", row.summary, productExisting);
      await add("product", ref, "body", row.body, productExisting);
    }
  }

  for (const row of steps.data ?? []) {
    const ref = String(row.id);
    await add("step", ref, "customer_title", row.customer_title, stepExisting);
    await add("step", ref, "customer_description", row.customer_description, stepExisting);
  }
  for (const row of fields.data ?? []) {
    const ref = String(row.id);
    await add("field", ref, "customer_label", row.customer_label, fieldExisting);
    await add("field", ref, "help_text", row.help_text, fieldExisting);
  }
  for (const row of options.data ?? []) {
    const ref = String(row.id);
    await add("field_option", ref, "customer_label", row.customer_label, optionExisting);
    await add("field_option", ref, "description", row.description, optionExisting);
  }

  return cells;
}

async function collectCatalogues(db: any, target: Lang, overwrite: boolean): Promise<Cell[]> {
  const cells: Cell[] = [];
  const add = (
    scope: TextScope,
    ref: string,
    field: string,
    source: unknown,
    existing: Map<string, string>,
  ) => {
    const text = trimmed(source);
    if (text === "") return;
    if (!overwrite && (existing.get(`${ref}::${field}`) ?? "") !== "") return;
    cells.push({
      key: `${scope}:${ref}:${field}`,
      text,
      write: textCell(db, scope, ref, field, target.code),
    });
  };

  const [rooms, transports, motorbikes, catalogues] = await Promise.all([
    db.from("accommodation_rooms").select("id, public_name, internal_name, description"),
    db.from("transports").select("id, public_name, internal_name, description"),
    db.from("motorbikes").select("id, public_name, internal_name, description"),
    db.from("catalogues").select("id, people_label, hours_label"),
  ]);

  const [roomExisting, transportExisting, motorbikeExisting, catalogueExisting] = await Promise.all([
    existingTexts(db, "accommodation_room", target.code),
    existingTexts(db, "transport", target.code),
    existingTexts(db, "motorbike", target.code),
    existingTexts(db, "catalogue", target.code),
  ]);

  const simple = [
    { scope: "accommodation_room" as TextScope, rows: rooms.data, existing: roomExisting },
    { scope: "transport" as TextScope, rows: transports.data, existing: transportExisting },
    { scope: "motorbike" as TextScope, rows: motorbikes.data, existing: motorbikeExisting },
  ];
  for (const group of simple) {
    for (const row of group.rows ?? []) {
      const ref = String(row.id);
      add(group.scope, ref, "name", row.public_name || row.internal_name, group.existing);
      add(group.scope, ref, "description", row.description, group.existing);
    }
  }
  for (const row of catalogues.data ?? []) {
    const ref = String(row.id);
    add("catalogue", ref, "people_label", row.people_label, catalogueExisting);
    add("catalogue", ref, "hours_label", row.hours_label, catalogueExisting);
  }

  return cells;
}

async function collectUi(db: any, target: Lang, overwrite: boolean): Promise<Cell[]> {
  const existing = await existingTexts(db, "ui", target.code);
  const cells: Cell[] = [];
  UI_STRINGS.forEach((english, index) => {
    if (!overwrite && (existing.get(`${english}::text`) ?? "") !== "") return;
    cells.push({
      key: `ui:${index}`,
      text: english,
      write: textCell(db, "ui", english, "text", target.code),
    });
  });
  return cells;
}

/* ------------------------------------------------------------------ */
/* Runner                                                             */
/* ------------------------------------------------------------------ */

/**
 * Translates every missing text of the requested scopes. Returns how many texts
 * were written.
 */
export async function runSiteTranslation(options: {
  db: any;
  master: Lang;
  target: Lang;
  overwrite: boolean;
  scopes: TranslationScope[];
}): Promise<number> {
  const { db, master, target, overwrite, scopes } = options;
  const cells: Cell[] = [];
  if (scopes.includes("website")) cells.push(...(await collectWebsite(db, master, target, overwrite)));
  if (scopes.includes("products")) cells.push(...(await collectProducts(db, target, overwrite)));
  if (scopes.includes("catalogues")) cells.push(...(await collectCatalogues(db, target, overwrite)));
  if (scopes.includes("ui")) cells.push(...(await collectUi(db, target, overwrite)));
  if (cells.length === 0) return 0;

  const { translateEntries } = await import("@/lib/translate.server");
  let written = 0;
  for (let i = 0; i < cells.length; i += BATCH) {
    const batch = cells.slice(i, i + BATCH);
    const result = await translateEntries(
      batch.map((cell) => ({ key: cell.key, text: cell.text })),
      target,
      master,
    );
    for (const cell of batch) {
      const value = result[cell.key];
      if (!value) continue;
      await cell.write(value);
      written += 1;
    }
  }
  return written;
}

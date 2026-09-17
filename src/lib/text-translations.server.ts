/**
 * Generic customer-facing text translations — server-only.
 *
 * One table (`text_translations`) holds the translated copy for everything that
 * did not already have its own translation table: products, configurator steps,
 * questions and options, catalogue items and the fixed interface strings.
 *
 * Reads always fall back to the original (master) text, so a missing
 * translation never changes behaviour.
 */

export type TextScope =
  | "product"
  | "step"
  | "field"
  | "field_option"
  | "accommodation_room"
  | "transport"
  | "motorbike"
  | "catalogue"
  | "ui";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type TextMap = Map<string, string>;

const cellKey = (ref: string, field: string) => `${ref}::${field}`;

/** Translated texts of one scope, for the given refs (all refs when omitted). */
export async function loadTexts(
  scope: TextScope,
  language: string | null,
  refs?: string[],
): Promise<TextMap> {
  const map: TextMap = new Map();
  if (!language) return map;
  if (refs && refs.length === 0) return map;
  const db = await admin();
  let query = db
    .from("text_translations")
    .select("ref, field, value")
    .eq("scope", scope)
    .eq("language_code", language);
  if (refs) query = query.in("ref", refs);
  const { data } = await query;
  for (const row of data ?? []) {
    const value = typeof row.value === "string" ? row.value.trim() : "";
    if (value !== "") map.set(cellKey(String(row.ref), String(row.field)), value);
  }
  return map;
}

/** The translated text, or the original when there is none. */
export function translated<T extends string | null | undefined>(
  map: TextMap,
  ref: string,
  field: string,
  fallback: T,
): T | string {
  return map.get(cellKey(ref, field)) ?? fallback;
}

export async function upsertText(
  db: any,
  scope: TextScope,
  ref: string,
  field: string,
  language: string,
  value: string | null,
) {
  await db
    .from("text_translations")
    .upsert(
      { scope, ref, field, language_code: language, value },
      { onConflict: "scope,ref,field,language_code" },
    );
}

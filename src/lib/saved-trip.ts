/**
 * Save & share a trip — pure helpers shared by server and tests.
 *
 * A saved trip stores configuration references only (product ids, catalogue
 * item ids, answers). It never stores a price: every reopen is re-quoted with
 * the live pricing engine.
 */

export type SavedPackageLine = {
  kind: "package";
  product_id: string;
  answers: Record<string, unknown>;
  season_month: number | null;
  promo_code: string | null;
};

export type SavedCatalogueLine = {
  kind: "catalogue_item";
  catalogue_id: string;
  catalogue_item_id: string;
  answers: Record<string, unknown>;
};

export type SavedTripLine = SavedPackageLine | SavedCatalogueLine;

/** Unambiguous alphabet: no O/0, I/1, etc. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TRIP_CODE_PREFIX = "CBR-";
const CODE_LENGTH = 5;

/** A share code such as `CBR-X7K4P`. Carries no personal information. */
export function generateTripCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)] ?? ALPHABET[0];
  }
  return `${TRIP_CODE_PREFIX}${out}`;
}

/** Accepts what a customer may paste (lowercase, missing prefix, spaces). */
export function normalizeTripCode(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  const body = raw.startsWith(TRIP_CODE_PREFIX) ? raw.slice(TRIP_CODE_PREFIX.length) : raw;
  if (body.length !== CODE_LENGTH) return null;
  for (const ch of body) if (!ALPHABET.includes(ch)) return null;
  return `${TRIP_CODE_PREFIX}${body}`;
}

/** Keeps only what is needed to rebuild a cart line; drops everything else. */
export function toSavedTripLine(row: {
  line_kind?: string | null;
  product_id?: string | null;
  catalogue_id?: string | null;
  catalogue_item_id?: string | null;
  answers?: unknown;
  season_month?: number | null;
  promo_code?: string | null;
}): SavedTripLine | null {
  const answers = (row.answers && typeof row.answers === "object" ? row.answers : {}) as Record<
    string,
    unknown
  >;

  if (row.line_kind === "catalogue_item") {
    if (!row.catalogue_id || !row.catalogue_item_id) return null;
    return {
      kind: "catalogue_item",
      catalogue_id: row.catalogue_id,
      catalogue_item_id: row.catalogue_item_id,
      answers,
    };
  }

  if (!row.product_id) return null;
  return {
    kind: "package",
    product_id: row.product_id,
    answers,
    season_month: row.season_month ?? null,
    promo_code: row.promo_code ?? null,
  };
}

/** Defensive read of stored JSON: unknown shapes are ignored, never thrown. */
export function parseSavedTripLines(value: unknown): SavedTripLine[] {
  if (!Array.isArray(value)) return [];
  const out: SavedTripLine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (row["kind"] === "catalogue_item") {
      if (typeof row["catalogue_id"] === "string" && typeof row["catalogue_item_id"] === "string") {
        out.push({
          kind: "catalogue_item",
          catalogue_id: row["catalogue_id"],
          catalogue_item_id: row["catalogue_item_id"],
          answers: (row["answers"] ?? {}) as Record<string, unknown>,
        });
      }
      continue;
    }
    if (row["kind"] === "package" && typeof row["product_id"] === "string") {
      out.push({
        kind: "package",
        product_id: row["product_id"],
        answers: (row["answers"] ?? {}) as Record<string, unknown>,
        season_month: typeof row["season_month"] === "number" ? row["season_month"] : null,
        promo_code: typeof row["promo_code"] === "string" ? row["promo_code"] : null,
      });
    }
  }
  return out;
}

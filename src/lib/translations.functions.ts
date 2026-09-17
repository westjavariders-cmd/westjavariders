/**
 * Translations — server functions.
 *
 * One Admin-only action translates the whole site into a chosen language, and a
 * small editor lets an admin correct any translated text by hand. Nothing here
 * touches pricing, cart, checkout, payments or vouchers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { UI_STRINGS } from "@/lib/ui-strings";
import { resolveLanguage } from "@/lib/language.server";

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class TranslationError extends Error {}
function fail(message: string): never {
  throw new TranslationError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change translations.");
}

const SCOPES = ["website", "products", "catalogues", "ui"] as const;

async function languagePair(supabase: any, code: string) {
  const { data } = await supabase.from("languages").select("code, name, is_master, is_active");
  const rows = (data ?? []) as { code: string; name: string; is_master: boolean; is_active: boolean }[];
  const master = rows.find((l) => l.is_master) ?? rows[0];
  const target = rows.find((l) => l.code === code && l.is_active);
  if (!master) fail("No master language is configured.");
  if (!target) fail("That language is not active.");
  if (target.code === master.code) fail("This is already the master language.");
  return {
    master: { code: master.code, name: master.name },
    target: { code: target.code, name: target.name },
  };
}

/** Translates the whole public site into one language. */
export const translateSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        language: z.string().trim().min(2).max(10),
        overwrite: z.boolean().optional(),
        scopes: z.array(z.enum(SCOPES)).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { master, target } = await languagePair(supabase, data.language);

    const { runSiteTranslation } = await import("@/lib/translate-site.server");
    let translated = 0;
    try {
      translated = await runSiteTranslation({
        db: supabase,
        master,
        target,
        overwrite: data.overwrite === true,
        scopes: data.scopes && data.scopes.length > 0 ? [...data.scopes] : [...SCOPES],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "AI_NOT_CONFIGURED") fail("Automatic translation is not available yet.");
      if (message === "AI_CREDITS")
        fail("Automatic translation is unavailable: the workspace AI credits are exhausted.");
      fail("The texts could not be translated. Please try again.");
    }

    await supabase.from("admin_audit_log").insert({
      actor_id: userId,
      action: "site.translated",
      entity_type: "languages",
      entity_id: null,
      entity_ref: target.code,
      details: { fields: translated, overwrite: data.overwrite === true } as never,
    });
    return { translated };
  });

export type TranslationRow = {
  scope: string;
  ref: string;
  field: string;
  source: string;
  value: string | null;
};

/** Every translated text of one language, for the manual editor. */
export const listTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ language: z.string().trim().min(2).max(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const { data: rows } = await supabase
      .from("text_translations")
      .select("scope, ref, field, value")
      .eq("language_code", data.language)
      .order("scope")
      .order("ref");

    const stored = (rows ?? []) as TranslationRow[];
    const sources = new Map<string, string>();

    const ids = (scope: string) =>
      stored.filter((r) => r.scope === scope).map((r) => r.ref);

    const productIds = ids("product");
    if (productIds.length > 0) {
      const { data: masterRows } = await supabase
        .from("product_translations")
        .select("product_id, title, summary, body")
        .in("product_id", productIds)
        .eq("language_code", "en");
      for (const row of masterRows ?? []) {
        for (const field of ["title", "summary", "body"]) {
          sources.set(`product::${row.product_id}::${field}`, String((row as any)[field] ?? ""));
        }
      }
    }

    const tables: { scope: string; table: string; fields: string[] }[] = [
      { scope: "step", table: "steps", fields: ["customer_title", "customer_description"] },
      { scope: "field", table: "fields", fields: ["customer_label", "help_text"] },
      { scope: "field_option", table: "field_options", fields: ["customer_label", "description"] },
      { scope: "catalogue", table: "catalogues", fields: ["people_label", "hours_label"] },
      { scope: "accommodation_room", table: "accommodation_rooms", fields: ["public_name", "internal_name", "description"] },
      { scope: "transport", table: "transports", fields: ["public_name", "internal_name", "description"] },
      { scope: "motorbike", table: "motorbikes", fields: ["public_name", "internal_name", "description"] },
    ];
    for (const group of tables) {
      const refs = ids(group.scope);
      if (refs.length === 0) continue;
      const { data: rows2 } = await supabase
        .from(group.table)
        .select(["id", ...group.fields].join(", "))
        .in("id", refs);
      for (const row of rows2 ?? []) {
        const anyRow = row as any;
        for (const field of group.fields) {
          sources.set(`${group.scope}::${anyRow.id}::${field}`, String(anyRow[field] ?? ""));
        }
        if (group.fields.includes("public_name")) {
          sources.set(
            `${group.scope}::${anyRow.id}::name`,
            String(anyRow.public_name || anyRow.internal_name || ""),
          );
        }
      }
    }

    const known = new Set(UI_STRINGS);
    return stored.map((row) => ({
      ...row,
      source:
        row.scope === "ui"
          ? known.has(row.ref)
            ? row.ref
            : row.ref
          : (sources.get(`${row.scope}::${row.ref}::${row.field}`) ?? ""),
    }));
  });

/** Corrects one translated text by hand. */
export const saveTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        scope: z.string().trim().min(2).max(40),
        ref: z.string().trim().min(1).max(400),
        field: z.string().trim().min(1).max(60),
        language: z.string().trim().min(2).max(10),
        value: z.string().max(6000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    await assertAdmin(supabase);
    const { upsertText } = await import("@/lib/text-translations.server");
    const value = data.value.trim();
    await upsertText(
      supabase,
      data.scope as never,
      data.ref,
      data.field,
      data.language,
      value === "" ? null : value,
    );
    return { ok: true };
  });

/** The fixed interface strings for the visitor's language. */
export const getUiStrings = createServerFn({ method: "GET" }).handler(async () => {
  const language = await resolveLanguage();
  if (!language) return { language: null, strings: {} as Record<string, string> };
  const { loadTexts } = await import("@/lib/text-translations.server");
  const map = await loadTexts("ui", language);
  const strings: Record<string, string> = {};
  for (const text of UI_STRINGS) {
    const value = map.get(`${text}::text`);
    if (value) strings[text] = value;
  }
  return { language, strings };
});

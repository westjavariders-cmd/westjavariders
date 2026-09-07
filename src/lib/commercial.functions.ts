import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MASTER_LANGUAGE, type ProductBundle } from "@/lib/catalog";
import { isPurchasable, resolveInputs } from "@/lib/pricing";
import {
  MONTHS,
  SEASON_PERIODS,
  priceCommercial,
  validateSeason,
  type SeasonConfig,
} from "@/lib/commercial";

/**
 * Server-authoritative season and promotion. The browser never decides a
 * discount, an eligibility or a final price.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class CommercialError extends Error {}
function fail(message: string): never {
  throw new CommercialError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change seasons or promo codes.");
}

async function audit(
  supabase: any,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  entityRef: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_ref: entityRef,
    details: details as never,
  });
}

/* ------------------------------------------------------------------ */
/* Season configuration                                               */
/* ------------------------------------------------------------------ */

async function loadSeason(supabase: any, productId: string): Promise<SeasonConfig> {
  const [settings, periods, months] = await Promise.all([
    supabase.from("product_season_settings").select("*").eq("product_id", productId).maybeSingle(),
    supabase.from("product_season_periods").select("*").eq("product_id", productId),
    supabase.from("product_season_months").select("*").eq("product_id", productId).order("month"),
  ]);
  return { settings: settings.data ?? null, periods: periods.data ?? [], months: months.data ?? [] };
}

export const getSeasonConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const config = await loadSeason(supabase, data.productId);
    return { ...config, issues: validateSeason(config) };
  });

const monthSchema = z.object({
  month: z.number().int().min(1).max(12),
  period: z.enum(SEASON_PERIODS),
});

export const saveSeasonConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        enabled: z.boolean(),
        discounts: z.record(z.enum(SEASON_PERIODS), z.number().min(0).max(100)),
        months: z.array(monthSchema).max(12),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { data: product } = await supabase
      .from("products")
      .select("id, internal_name")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product) fail("This product could not be found.");

    const seen = new Set<number>();
    for (const m of data.months) {
      if (seen.has(m.month)) fail("Each month can belong to only one season.");
      seen.add(m.month);
    }
    if (data.enabled && seen.size !== MONTHS.length) {
      fail("Every month must be assigned to a season before seasonal pricing can be used.");
    }

    const before = await loadSeason(supabase, data.productId);

    const { error: settingsError } = await supabase
      .from("product_season_settings")
      .upsert({ product_id: data.productId, enabled: data.enabled }, { onConflict: "product_id" });
    if (settingsError) fail(SAFE_ERROR);

    for (const period of SEASON_PERIODS) {
      const pct = period === "HIGH" ? 0 : (data.discounts[period] ?? 0);
      const { error } = await supabase
        .from("product_season_periods")
        .upsert(
          { product_id: data.productId, period, discount_percentage: pct },
          { onConflict: "product_id,period" },
        );
      if (error) fail(SAFE_ERROR);
    }

    await supabase.from("product_season_months").delete().eq("product_id", data.productId);
    if (data.months.length > 0) {
      const { error } = await supabase
        .from("product_season_months")
        .insert(data.months.map((m) => ({ product_id: data.productId, month: m.month, period: m.period })));
      if (error) fail(SAFE_ERROR);
    }

    const after = await loadSeason(supabase, data.productId);
    const issues = validateSeason(after).filter((i) => i.level === "error");
    if (issues.length > 0) fail(issues[0]!.message);

    if (before.settings?.enabled !== data.enabled) {
      await audit(
        supabase,
        userId,
        data.enabled ? "season_pricing_enabled" : "season_pricing_disabled",
        "product_season_settings",
        data.productId,
        product.internal_name,
      );
    }
    await audit(
      supabase,
      userId,
      "season_pricing_updated",
      "product_season_settings",
      data.productId,
      product.internal_name,
      { discounts: data.discounts, months: data.months },
    );
    return { ...after, issues: validateSeason(after) };
  });

/* ------------------------------------------------------------------ */
/* Promo codes                                                        */
/* ------------------------------------------------------------------ */

const promoInput = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "A promo code may use letters, numbers, hyphen and underscore only."),
  internal_name: z.string().trim().min(1).max(200),
  discount_percentage: z.number().gt(0).max(100),
  active: z.boolean(),
  starts_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  gift_eligible: z.boolean(),
  notes: z.string().max(2000).nullable(),
  productIds: z.array(z.string().uuid()).max(500),
  categoryIds: z.array(z.string().uuid()).max(200),
});

function checkDates(starts: string | null, expires: string | null) {
  if (starts && expires && new Date(expires) <= new Date(starts)) {
    fail("The end date must be after the start date.");
  }
}

async function checkReferences(supabase: any, productIds: string[], categoryIds: string[]) {
  if (productIds.length > 0) {
    const { data } = await supabase.from("products").select("id, kind").in("id", productIds);
    if ((data ?? []).length !== productIds.length) fail("One of the selected products no longer exists.");
    if ((data ?? []).some((p: any) => p.kind === "insurance")) {
      fail("Insurance can never receive a promotion.");
    }
  }
  if (categoryIds.length > 0) {
    const { data } = await supabase.from("categories").select("id").in("id", categoryIds);
    if ((data ?? []).length !== categoryIds.length) fail("One of the selected categories no longer exists.");
  }
}

async function replaceLinks(
  supabase: any,
  promoId: string,
  productIds: string[],
  categoryIds: string[],
) {
  await supabase.from("promo_code_products").delete().eq("promo_code_id", promoId);
  await supabase.from("promo_code_categories").delete().eq("promo_code_id", promoId);
  if (productIds.length > 0) {
    const { error } = await supabase
      .from("promo_code_products")
      .insert(productIds.map((product_id) => ({ promo_code_id: promoId, product_id })));
    if (error) fail(SAFE_ERROR);
  }
  if (categoryIds.length > 0) {
    const { error } = await supabase
      .from("promo_code_categories")
      .insert(categoryIds.map((category_id) => ({ promo_code_id: promoId, category_id })));
    if (error) fail(SAFE_ERROR);
  }
}

export const createPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => promoInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    checkDates(data.starts_at, data.expires_at);
    await checkReferences(supabase, data.productIds, data.categoryIds);

    const { data: created, error } = await supabase
      .from("promo_codes")
      .insert({
        code: data.code.toUpperCase(),
        internal_name: data.internal_name,
        discount_percentage: data.discount_percentage,
        active: data.active,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
        gift_eligible: data.gift_eligible,
        notes: data.notes,
      })
      .select("id, code")
      .single();
    if (error || !created) {
      fail(/duplicate|unique/i.test(error?.message ?? "") ? "That promo code already exists." : SAFE_ERROR);
    }
    await replaceLinks(supabase, created.id, data.productIds, data.categoryIds);
    await audit(supabase, userId, "promo_created", "promo_codes", created.id, created.code, {
      percentage: data.discount_percentage,
    });
    return { id: created.id as string };
  });

export const updatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => promoInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    checkDates(data.starts_at, data.expires_at);
    await checkReferences(supabase, data.productIds, data.categoryIds);

    const { error } = await supabase
      .from("promo_codes")
      .update({
        code: data.code.toUpperCase(),
        internal_name: data.internal_name,
        discount_percentage: data.discount_percentage,
        active: data.active,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
        gift_eligible: data.gift_eligible,
        notes: data.notes,
      })
      .eq("id", data.id);
    if (error) {
      fail(/duplicate|unique/i.test(error.message) ? "That promo code already exists." : SAFE_ERROR);
    }
    await replaceLinks(supabase, data.id, data.productIds, data.categoryIds);
    await audit(supabase, userId, "promo_updated", "promo_codes", data.id, data.code.toUpperCase());
    return { ok: true };
  });

export const setPromoCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: row } = await supabase.from("promo_codes").select("code").eq("id", data.id).maybeSingle();
    if (!row) fail("This promo code could not be found.");
    const { error } = await supabase.from("promo_codes").update({ active: data.active }).eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(
      supabase,
      userId,
      data.active ? "promo_activated" : "promo_deactivated",
      "promo_codes",
      data.id,
      row.code,
    );
    return { ok: true };
  });

export const deletePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: row } = await supabase.from("promo_codes").select("code").eq("id", data.id).maybeSingle();
    if (!row) fail("This promo code could not be found.");
    const { error } = await supabase.from("promo_codes").delete().eq("id", data.id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "promo_deleted", "promo_codes", data.id, row.code);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Commercial calculation                                             */
/* ------------------------------------------------------------------ */

async function loadPricingContext(supabase: any, productId: string) {
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (!product) fail("This product could not be found.");

  const [translation, components, flow, fields, dependencies, pricing, categories] = await Promise.all([
    supabase
      .from("product_translations")
      .select("*")
      .eq("product_id", productId)
      .eq("language_code", MASTER_LANGUAGE)
      .maybeSingle(),
    supabase.from("product_components").select("*").eq("product_id", productId).order("display_order"),
    supabase.from("config_flows").select("*").eq("product_id", productId).maybeSingle(),
    supabase.from("fields").select("*").eq("product_id", productId).order("display_order"),
    supabase.from("dependencies").select("*").eq("product_id", productId),
    supabase.from("product_pricing").select("*").eq("product_id", productId).maybeSingle(),
    supabase.from("product_categories").select("category_id").eq("product_id", productId),
  ]);

  const steps = flow.data
    ? (await supabase.from("steps").select("*").eq("flow_id", flow.data.id).order("display_order")).data
    : [];
  const fieldIds = (fields.data ?? []).map((f: any) => f.id);
  const options = fieldIds.length
    ? (await supabase.from("field_options").select("*").in("field_id", fieldIds).order("display_order")).data
    : [];

  const bundle: ProductBundle = {
    product,
    translation: translation.data,
    categoryIds: (categories.data ?? []).map((c: any) => c.category_id),
    placements: [],
    components: components.data ?? [],
    flow: flow.data,
    steps: steps ?? [],
    fields: fields.data ?? [],
    options: options ?? [],
    dependencies: dependencies.data ?? [],
  };

  const pricingRow = pricing.data;
  if (!pricingRow) fail("This product has no pricing configuration yet.");
  const rules =
    (await supabase.from("pricing_rules").select("*").eq("pricing_id", pricingRow.id).order("display_order"))
      .data ?? [];
  const ruleIds = rules.map((r: any) => r.id);
  const tiers = ruleIds.length
    ? ((await supabase.from("pricing_tiers").select("*").in("rule_id", ruleIds).order("display_order")).data ??
      [])
    : [];
  const versions =
    (await supabase.from("formula_versions").select("*").eq("pricing_id", pricingRow.id).order("version"))
      .data ?? [];

  return { bundle, pricing: pricingRow, rules, tiers, versions };
}

const commercialInput = z.object({
  productId: z.string().uuid(),
  values: z.record(z.string(), z.unknown()),
  month: z.number().int().min(1).max(12).nullable().optional(),
  promoCode: z.string().trim().max(40).nullable().optional(),
  isGift: z.boolean().optional(),
});

async function computeCommercial(
  supabase: any,
  data: z.infer<typeof commercialInput>,
  options: { requirePurchasable: boolean },
) {
  const loaded = await loadPricingContext(supabase, data.productId);
  const purchasable = isPurchasable(loaded.bundle.product.status, loaded.pricing.status);
  if (options.requirePurchasable && !purchasable) {
    fail("This product is not purchasable: its pricing is not active.");
  }

  const season = await loadSeason(supabase, data.productId);

  let promo: any = null;
  let promoProductIds: string[] = [];
  let promoCategoryIds: string[] = [];
  if (data.promoCode) {
    const { data: row } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", data.promoCode.toUpperCase())
      .maybeSingle();
    if (!row) {
      return {
        ...emptyPromoResult(loaded, season, data, purchasable),
        promo_rejection: "This promo code does not exist.",
      };
    }
    promo = row;
    const [p, c] = await Promise.all([
      supabase.from("promo_code_products").select("product_id").eq("promo_code_id", row.id),
      supabase.from("promo_code_categories").select("category_id").eq("promo_code_id", row.id),
    ]);
    promoProductIds = (p.data ?? []).map((x: any) => x.product_id);
    promoCategoryIds = (c.data ?? []).map((x: any) => x.category_id);
  }

  const inputs = resolveInputs(loaded.bundle, data.values as never);
  const active = loaded.versions.find((v: any) => v.is_active) ?? null;
  const month = data.month ?? new Date().getUTCMonth() + 1;

  const result = priceCommercial({
    bundle: loaded.bundle,
    pricing: loaded.pricing,
    rules: loaded.rules,
    tiers: loaded.tiers,
    formula: active,
    inputs,
    season,
    month,
    promoContext: {
      promo,
      productId: data.productId,
      categoryIds: loaded.bundle.categoryIds,
      promoProductIds,
      promoCategoryIds,
      isGift: data.isGift === true,
      now: new Date(),
    },
  });

  return { ...result, month, purchasable, season_enabled: season.settings?.enabled === true };
}

function emptyPromoResult(loaded: any, season: SeasonConfig, data: any, purchasable: boolean) {
  const inputs = resolveInputs(loaded.bundle, data.values as never);
  const active = loaded.versions.find((v: any) => v.is_active) ?? null;
  const month = data.month ?? new Date().getUTCMonth() + 1;
  const result = priceCommercial({
    bundle: loaded.bundle,
    pricing: loaded.pricing,
    rules: loaded.rules,
    tiers: loaded.tiers,
    formula: active,
    inputs,
    season,
    month,
    promoContext: {
      promo: null,
      productId: data.productId,
      categoryIds: loaded.bundle.categoryIds,
      promoProductIds: [],
      promoCategoryIds: [],
      isGift: data.isGift === true,
      now: new Date(),
    },
  });
  return { ...result, month, purchasable, season_enabled: season.settings?.enabled === true };
}

/** Admin test lab: works while pricing is still draft. */
export const previewCommercialPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => commercialInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    return computeCommercial(supabase, data, { requirePurchasable: false });
  });

/** Final customer price for a purchasable product. Used by later phases. */
export const quoteCommercialPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => commercialInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const result = await computeCommercial(supabase, data, { requirePurchasable: true });
    if (result.errors.length > 0) fail(result.errors[0]!);
    return result;
  });

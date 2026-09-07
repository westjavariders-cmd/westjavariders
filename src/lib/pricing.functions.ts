import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MASTER_LANGUAGE, type ProductBundle } from "@/lib/catalog";
import {
  evaluateFormula,
  formulaScope,
  isPurchasable,
  priceProduct,
  resolveInputs,
  validatePricing,
  type PriceResult,
} from "@/lib/pricing";

/**
 * Server-authoritative pricing: validation, activation and calculation.
 * The browser is never trusted for a commercial price.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class PricingConfigError extends Error {}
function fail(message: string): never {
  throw new PricingConfigError(message);
}

type AuthedContext = { supabase: any; userId: string };
const ctx = (context: unknown) => context as AuthedContext;

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change pricing.");
}

async function audit(
  supabase: any,
  actorId: string,
  action: string,
  entityId: string | null,
  entityRef: string | null,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "product_pricing",
    entity_id: entityId,
    entity_ref: entityRef,
    details: details as never,
  });
}

/** Loads the product configuration and its pricing with the caller's own rights. */
async function loadPricingContext(supabase: any, productId: string) {
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (!product) fail("This product could not be found.");

  const [translation, components, flow, fields, dependencies, pricing] = await Promise.all([
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
    categoryIds: [],
    placements: [],
    components: components.data ?? [],
    flow: flow.data,
    steps: steps ?? [],
    fields: fields.data ?? [],
    options: options ?? [],
    dependencies: dependencies.data ?? [],
  };

  const pricingRow = pricing.data;
  const rules = pricingRow
    ? ((await supabase.from("pricing_rules").select("*").eq("pricing_id", pricingRow.id).order("display_order"))
        .data ?? [])
    : [];
  const ruleIds = rules.map((r: any) => r.id);
  const tiers = ruleIds.length
    ? ((await supabase.from("pricing_tiers").select("*").in("rule_id", ruleIds).order("display_order")).data ??
      [])
    : [];
  const versions = pricingRow
    ? ((await supabase.from("formula_versions").select("*").eq("pricing_id", pricingRow.id).order("version"))
        .data ?? [])
    : [];

  return { bundle, pricing: pricingRow, rules, tiers, versions };
}

/** Creates the pricing row for a product if it has none yet. */
export const ensurePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const { data: existing } = await supabase
      .from("product_pricing")
      .select("id")
      .eq("product_id", data.productId)
      .maybeSingle();
    if (existing) return { id: existing.id as string, created: false };

    const { data: created, error } = await supabase
      .from("product_pricing")
      .insert({ product_id: data.productId })
      .select("id")
      .single();
    if (error || !created) fail(SAFE_ERROR);
    await audit(supabase, userId, "pricing_created", created.id, data.productId);
    return { id: created.id as string, created: true };
  });

/** Recomputes the pricing problem list on the server. */
export const validateProductPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const loaded = await loadPricingContext(supabase, data.productId);
    return {
      issues: validatePricing(loaded),
      purchasable: isPurchasable(loaded.bundle.product.status, loaded.pricing?.status),
    };
  });

export const setPricingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), status: z.enum(["draft", "active"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const loaded = await loadPricingContext(supabase, data.productId);
    if (!loaded.pricing) fail("This product has no pricing configuration yet.");

    if (data.status === "active") {
      const issues = validatePricing(loaded).filter((i) => i.level === "error");
      if (issues.length > 0) {
        fail(`Pricing cannot be activated: ${issues[0]!.message}`);
      }
    }

    const { error } = await supabase
      .from("product_pricing")
      .update({ status: data.status })
      .eq("id", loaded.pricing.id);
    if (error) fail(SAFE_ERROR);
    await audit(supabase, userId, "pricing_status_changed", loaded.pricing.id, data.productId, {
      status: data.status,
    });
    return { ok: true };
  });

/** Creates the next formula version. An active version is never edited in place. */
export const createFormulaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), expression: z.string().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const loaded = await loadPricingContext(supabase, data.productId);
    if (!loaded.pricing) fail("This product has no pricing configuration yet.");

    // Reject a formula that cannot even be parsed, before it is stored.
    try {
      evaluateFormula(data.expression, formulaScope(loaded.bundle, loaded.pricing, {}));
    } catch (e) {
      const message = e instanceof Error ? e.message : "The formula is not valid.";
      if (!/is not a known value|needs a number|same kind/.test(message)) fail(message);
    }

    const next = Math.max(0, ...loaded.versions.map((v: any) => v.version)) + 1;
    const { data: created, error } = await supabase
      .from("formula_versions")
      .insert({
        pricing_id: loaded.pricing.id,
        version: next,
        expression: data.expression,
        created_by: userId,
      })
      .select("id, version")
      .single();
    if (error || !created) fail(SAFE_ERROR);
    await audit(supabase, userId, "formula_version_created", created.id, data.productId, {
      version: created.version,
    });
    return { id: created.id as string, version: created.version as number };
  });

export const activateFormulaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), versionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const loaded = await loadPricingContext(supabase, data.productId);
    if (!loaded.pricing) fail("This product has no pricing configuration yet.");
    const version = loaded.versions.find((v: any) => v.id === data.versionId);
    if (!version) fail("That formula version does not belong to this product.");

    try {
      const result = evaluateFormula(version.expression, formulaScope(loaded.bundle, loaded.pricing, {}));
      if (result.type !== "number") fail("The formula must produce a number.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "The formula is not valid.";
      if (!/is not a known value/.test(message)) fail(message);
    }

    await supabase
      .from("formula_versions")
      .update({ is_active: false, activated_at: null })
      .eq("pricing_id", loaded.pricing.id);
    const { error } = await supabase
      .from("formula_versions")
      .update({ is_active: true, activated_at: new Date().toISOString() })
      .eq("id", data.versionId);
    if (error) fail(SAFE_ERROR);
    await supabase
      .from("product_pricing")
      .update({ active_version_id: data.versionId })
      .eq("id", loaded.pricing.id);
    await audit(supabase, userId, "formula_version_activated", data.versionId, data.productId, {
      version: version.version,
    });
    return { ok: true };
  });

/**
 * Calculates a price from the stored configuration. Later phases (cart,
 * checkout) call this rather than trusting any client-supplied amount.
 */
async function computePriceForConfiguration(
  supabase: any,
  productId: string,
  values: Record<string, unknown>,
  options: { requirePurchasable: boolean },
): Promise<PriceResult & { purchasable: boolean }> {
  const loaded = await loadPricingContext(supabase, productId);
  if (!loaded.pricing) fail("This product has no pricing configuration yet.");
  const purchasable = isPurchasable(loaded.bundle.product.status, loaded.pricing.status);
  if (options.requirePurchasable && !purchasable) {
    fail("This product is not purchasable: its pricing is not active.");
  }

  const inputs = resolveInputs(loaded.bundle, values as never);
  const active = loaded.versions.find((v: any) => v.is_active) ?? null;
  const result = priceProduct({
    bundle: loaded.bundle,
    pricing: loaded.pricing,
    rules: loaded.rules,
    tiers: loaded.tiers,
    formula: active,
    inputs,
  });
  return { ...result, purchasable };
}

/** Admin test lab: prices a configuration even while pricing is still draft. */
export const previewPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), values: z.record(z.string(), z.unknown()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const result = await computePriceForConfiguration(supabase, data.productId, data.values, {
      requirePurchasable: false,
    });
    const loaded = await loadPricingContext(supabase, data.productId);
    const inputs = resolveInputs(loaded.bundle, data.values as never);
    return {
      ...result,
      resolved: Object.entries(inputs).map(([name, v]) => ({
        name,
        type: v.type,
        value: Array.isArray(v.value) ? v.value.join(", ") : String(v.value),
      })),
    };
  });

/** Commercial price for a purchasable product only. Used by later phases. */
export const quotePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), values: z.record(z.string(), z.unknown()) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const result = await computePriceForConfiguration(supabase, data.productId, data.values, {
      requirePurchasable: true,
    });
    return { total_idr: result.total_idr, lines: result.lines };
  });

/** Re-runs the saved test cases and reports pass/fail. */
export const runPricingTests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = ctx(context);
    const loaded = await loadPricingContext(supabase, data.productId);
    if (!loaded.pricing) fail("This product has no pricing configuration yet.");
    const { data: cases } = await supabase
      .from("pricing_test_cases")
      .select("*")
      .eq("pricing_id", loaded.pricing.id)
      .order("created_at");

    const active = loaded.versions.find((v: any) => v.is_active) ?? null;
    return (cases ?? []).map((c: any) => {
      const inputs = resolveInputs(loaded.bundle, c.inputs ?? {});
      const result = priceProduct({
        bundle: loaded.bundle,
        pricing: loaded.pricing,
        rules: loaded.rules,
        tiers: loaded.tiers,
        formula: active,
        inputs,
      });
      return {
        id: c.id as string,
        label: c.label as string,
        expected: c.expected_total_idr as number | null,
        actual: result.total_idr,
        errors: result.errors,
        passed:
          result.errors.length === 0 &&
          (c.expected_total_idr == null || Number(c.expected_total_idr) === result.total_idr),
      };
    });
  });

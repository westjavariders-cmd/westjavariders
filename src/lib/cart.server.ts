/**
 * Server-only Package + Cart persistence.
 *
 * Customers are anonymous in V1: a cart is identified by a high-entropy
 * session token held in an httpOnly cookie. Nothing here trusts a
 * client-supplied price: every quote is recomputed with the existing Phase 4
 * pricing engine and the Phase 5 season/promo engine.
 */
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import {
  MASTER_LANGUAGE,
  evaluateDependencies,
  type PreviewValues,
  type ProductBundle,
} from "@/lib/catalog";
import {
  exactToString,
  fromNumberLike,
  isPurchasable,
  resolveInputs,
  type PricingInputs,
} from "@/lib/pricing";
import { priceCommercial, type CommercialResult, type SeasonConfig } from "@/lib/commercial";
import {
  cataloguePriceVariables,
  fieldCatalogueType,
  resolveCatalogueSelections,
  stripInvalidCatalogueAnswers,
  type CatalogueSelection,
  type CatalogueType,
} from "@/lib/catalogue-bridge";
import { resolveCatalogues } from "@/lib/catalogue-bridge.server";

export const CART_COOKIE = "cbr_cart";
const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

export class CartError extends Error {}
export function fail(message: string): never {
  throw new CartError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/* ------------------------------------------------------------------ */
/* Anonymous session token                                            */
/* ------------------------------------------------------------------ */

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookieToken(): string | null {
  const header = getRequest().headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CART_COOKIE) {
      const value = rest.join("=");
      return /^[0-9a-f]{64}$/.test(value) ? value : null;
    }
  }
  return null;
}

function writeCookieToken(token: string) {
  setResponseHeader(
    "Set-Cookie",
    `${CART_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 30}`,
  );
}

/* ------------------------------------------------------------------ */
/* Cart                                                               */
/* ------------------------------------------------------------------ */

export type CartRow = {
  id: string;
  status: string;
  market_code: string | null;
  currency_code: string | null;
};

async function findCart(token: string): Promise<CartRow | null> {
  const db = await admin();
  const { data } = await db
    .from("carts")
    .select("id, status, market_code, currency_code")
    .eq("session_token", token)
    .eq("status", "open")
    .maybeSingle();
  return data ?? null;
}

/**
 * Returns the open cart for this browser, creating one only when asked.
 * `explicitToken` exists for server-side tests; requests always use the cookie.
 */
export async function currentCart(create: boolean, explicitToken?: string): Promise<CartRow | null> {
  const token = explicitToken ?? readCookieToken();
  if (token) {
    const existing = await findCart(token);
    if (existing) return existing;
  }
  if (!create) return null;

  const db = await admin();
  const fresh = token ?? newToken();
  const { data, error } = await db
    .from("carts")
    .insert({ session_token: fresh })
    .select("id, status, market_code, currency_code")
    .single();
  if (error || !data) fail(SAFE_ERROR);
  if (!explicitToken) writeCookieToken(fresh);
  return data;
}

/** Cart membership check: a package is only reachable through its own cart. */
async function assertPackageInCart(cartId: string, packageId: string) {
  const db = await admin();
  const { data } = await db
    .from("cart_packages")
    .select("id")
    .eq("cart_id", cartId)
    .eq("package_id", packageId)
    .maybeSingle();
  if (!data) fail("This package does not belong to your cart.");
}

/* ------------------------------------------------------------------ */
/* Pricing context (reuses Phase 3/4/5 tables and pure logic)         */
/* ------------------------------------------------------------------ */

async function loadSeason(db: any, productId: string): Promise<SeasonConfig> {
  const [settings, periods, months] = await Promise.all([
    db.from("product_season_settings").select("*").eq("product_id", productId).maybeSingle(),
    db.from("product_season_periods").select("*").eq("product_id", productId),
    db.from("product_season_months").select("*").eq("product_id", productId).order("month"),
  ]);
  return { settings: settings.data ?? null, periods: periods.data ?? [], months: months.data ?? [] };
}

async function loadPricingContext(db: any, productId: string) {
  const { data: product } = await db.from("products").select("*").eq("id", productId).maybeSingle();
  if (!product) fail("This product could not be found.");

  const [translation, components, flow, fields, dependencies, pricing, categories] = await Promise.all([
    db
      .from("product_translations")
      .select("*")
      .eq("product_id", productId)
      .eq("language_code", MASTER_LANGUAGE)
      .maybeSingle(),
    db.from("product_components").select("*").eq("product_id", productId).order("display_order"),
    db.from("config_flows").select("*").eq("product_id", productId).maybeSingle(),
    db.from("fields").select("*").eq("product_id", productId).order("display_order"),
    db.from("dependencies").select("*").eq("product_id", productId),
    db.from("product_pricing").select("*").eq("product_id", productId).maybeSingle(),
    db.from("product_categories").select("category_id").eq("product_id", productId),
  ]);

  const steps = flow.data
    ? (await db.from("steps").select("*").eq("flow_id", flow.data.id).order("display_order")).data
    : [];
  const fieldIds = (fields.data ?? []).map((f: any) => f.id);
  const options = fieldIds.length
    ? (await db.from("field_options").select("*").in("field_id", fieldIds).order("display_order")).data
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
    (await db.from("pricing_rules").select("*").eq("pricing_id", pricingRow.id).order("display_order")).data ??
    [];
  const ruleIds = rules.map((r: any) => r.id);
  const tiers = ruleIds.length
    ? ((await db.from("pricing_tiers").select("*").in("rule_id", ruleIds).order("display_order")).data ?? [])
    : [];
  const versions =
    (await db.from("formula_versions").select("*").eq("pricing_id", pricingRow.id).order("version")).data ?? [];

  return { bundle, pricing: pricingRow, rules, tiers, versions };
}

/** Required/visible answer check on top of the existing dependency engine. */
export function configurationIssues(bundle: ProductBundle, values: PreviewValues): string[] {
  const { fields: effects } = evaluateDependencies(bundle, values as never);
  const issues: string[] = [];
  for (const f of bundle.fields) {
    if (!f.is_active || f.field_type === "info_block") continue;
    const e = effects[f.id];
    if (!e) continue;
    if (e.hidden && !e.forcedVisible) continue;
    if (e.reset) continue;
    const raw = e.forcedValue ?? values[f.variable_name];
    const empty =
      raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    const label = f.customer_label || f.internal_name;
    if (e.required && empty) {
      issues.push(`${label} is required.`);
      continue;
    }
    if (empty) continue;
    if (f.field_type === "quantity" || f.field_type === "number") {
      const n = Number(Array.isArray(raw) ? raw[0] : raw);
      if (!Number.isFinite(n)) issues.push(`${label} must be a number.`);
      else if (e.min != null && n < e.min) issues.push(`${label} must be at least ${e.min}.`);
      else if (e.max != null && n > e.max) issues.push(`${label} must be at most ${e.max}.`);
    }
  }
  return issues;
}

function serializeInputs(inputs: PricingInputs) {
  const out: Record<string, { type: string; value: string | boolean | string[] }> = {};
  for (const [k, v] of Object.entries(inputs)) {
    out[k] = v.type === "number" ? { type: "number", value: exactToString(v.value) } : { type: v.type, value: v.value };
  }
  return out;
}

export type QuoteOutcome = {
  purchasable: boolean;
  configuration_issues: string[];
  errors: string[];
  promo_rejection: string | null;
  month: number;
  season_period: string | null;
  subtotal_idr: number;
  season_discount_idr: number;
  promo_discount_idr: number;
  total_idr: number;
  lines: CommercialResult["lines"];
  resolved_inputs: Record<string, { type: string; value: string | boolean | string[] }>;
  promo_code: string | null;
  promo_code_id: string | null;
  /** Catalogue items the customer selected, as resolved for this quote. */
  catalogue_selections: CatalogueSelection[];
  /** Answers with invalidated catalogue choices removed (never replaced). */
  answers: PreviewValues;
};

/** One provisional quote. Never an immutable purchase price. */
export async function quotePackage(args: {
  productId: string;
  answers: PreviewValues;
  month: number | null;
  promoCode: string | null;
  isGift: boolean;
}): Promise<QuoteOutcome> {
  const db = await admin();
  const loaded = await loadPricingContext(db, args.productId);
  const purchasable = isPurchasable(loaded.bundle.product.status, loaded.pricing.status);
  const season = await loadSeason(db, args.productId);

  let promo: any = null;
  let promoProductIds: string[] = [];
  let promoCategoryIds: string[] = [];
  let promoRejection: string | null = null;

  if (args.promoCode) {
    const { data: row } = await db
      .from("promo_codes")
      .select("*")
      .eq("code", args.promoCode.toUpperCase())
      .maybeSingle();
    if (!row) promoRejection = "This promo code does not exist.";
    else {
      promo = row;
      const [p, c] = await Promise.all([
        db.from("promo_code_products").select("product_id").eq("promo_code_id", row.id),
        db.from("promo_code_categories").select("category_id").eq("promo_code_id", row.id),
      ]);
      promoProductIds = (p.data ?? []).map((x: any) => x.product_id);
      promoCategoryIds = (c.data ?? []).map((x: any) => x.category_id);
    }
  }

  // Catalogue Bridge: resolve active items, drop invalidated selections and
  // expose each selected catalogue price to the existing pricing engine as
  // `<variable>_price`. The bridge never decides how that value is used.
  const catalogueFields = loaded.bundle.fields.filter((f: any) => f.is_active);
  const catalogue = await resolveCatalogues(
    catalogueFields
      .map((f: any) => fieldCatalogueType(f))
      .filter((t: CatalogueType | null): t is CatalogueType => t != null),
  );
  const answers = stripInvalidCatalogueAnswers(
    catalogueFields as never,
    args.answers as Record<string, unknown>,
    catalogue,
  ) as PreviewValues;
  const { selections, invalid } = resolveCatalogueSelections(
    catalogueFields as never,
    args.answers as Record<string, unknown>,
    catalogue,
    (f) => {
      const field = catalogueFields.find((x: any) => x.variable_name === f.variable_name) as any;
      return field?.customer_label || field?.internal_name || f.variable_name;
    },
  );

  const inputs = resolveInputs(loaded.bundle, answers as never);
  for (const [name, amount] of Object.entries(cataloguePriceVariables(selections))) {
    inputs[name] = { type: "number", value: fromNumberLike(amount) };
  }
  const active = loaded.versions.find((v: any) => v.is_active) ?? null;
  const month = args.month ?? new Date().getUTCMonth() + 1;

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
      productId: args.productId,
      categoryIds: loaded.bundle.categoryIds,
      promoProductIds,
      promoCategoryIds,
      isGift: args.isGift,
      now: new Date(),
    },
  });

  return {
    purchasable,
    configuration_issues: [...invalid, ...configurationIssues(loaded.bundle, answers)],
    errors: result.errors,
    promo_rejection: promoRejection ?? result.promo_rejection,
    month,
    season_period: result.season_period,
    subtotal_idr: result.phase4_total_idr,
    season_discount_idr: result.season_discount_idr,
    promo_discount_idr: result.promo_discount_idr,
    total_idr: result.final_total_idr,
    lines: result.lines,
    resolved_inputs: serializeInputs(inputs),
    promo_code: promo ? promo.code : null,
    promo_code_id: promo ? promo.id : null,
    catalogue_selections: selections,
    answers,
  };
}

/* ------------------------------------------------------------------ */
/* Package operations                                                 */
/* ------------------------------------------------------------------ */

const PACKAGE_FIELDS =
  "id, product_id, status, answers, resolved_inputs, quote_lines, subtotal_idr, season_discount_idr, promo_discount_idr, total_idr, season_month, season_period, promo_code, catalogue_selections, quoted_at, created_at, updated_at";

async function getDraft(cartId: string) {
  const db = await admin();
  const { data } = await db
    .from("cart_packages")
    .select(`package_id, position, packages!inner(${PACKAGE_FIELDS})`)
    .eq("cart_id", cartId)
    .eq("packages.status", "draft")
    .maybeSingle();
  return data ? (data as any).packages : null;
}

async function nextPosition(cartId: string) {
  const db = await admin();
  const { data } = await db
    .from("cart_packages")
    .select("position")
    .eq("cart_id", cartId)
    .order("position", { ascending: false })
    .limit(1);
  return ((data?.[0]?.position as number | undefined) ?? -1) + 1;
}

/** Starts a draft Package for a product. At most one draft per cart. */
export async function startPackage(productId: string, token?: string) {
  const cart = (await currentCart(true, token))!;
  const existingDraft = await getDraft(cart.id);
  if (existingDraft) {
    fail("You already have a package in progress. Finish or discard it first.");
  }

  const db = await admin();
  const { data: product } = await db
    .from("products")
    .select("id, kind, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product) fail("This product could not be found.");

  const { data: pkg, error } = await db
    .from("packages")
    .insert({ product_id: productId })
    .select(PACKAGE_FIELDS)
    .single();
  if (error || !pkg) fail(SAFE_ERROR);

  const { error: linkError } = await db
    .from("cart_packages")
    .insert({ cart_id: cart.id, package_id: pkg.id, position: await nextPosition(cart.id) });
  if (linkError) {
    await db.from("packages").delete().eq("id", pkg.id);
    fail(SAFE_ERROR);
  }
  return { cartId: cart.id, pkg };
}

/** Saves answers and re-quotes server-side. Draft only. */
export async function savePackage(args: {
  packageId: string;
  answers: PreviewValues;
  month: number | null;
  promoCode: string | null;
  token?: string;
}) {
  const cart = await currentCart(false, args.token);
  if (!cart) fail("Your cart could not be found.");
  await assertPackageInCart(cart.id, args.packageId);

  const db = await admin();
  const { data: pkg } = await db
    .from("packages")
    .select("id, product_id, status")
    .eq("id", args.packageId)
    .maybeSingle();
  if (!pkg) fail("This package could not be found.");
  if (pkg.status !== "draft") fail("A completed package can no longer be edited.");

  const quote = await quotePackage({
    productId: pkg.product_id,
    answers: args.answers,
    month: args.month,
    promoCode: args.promoCode,
    isGift: false,
  });

  const { data: updated, error } = await db
    .from("packages")
    .update({
      answers: quote.answers as never,
      resolved_inputs: quote.resolved_inputs as never,
      catalogue_selections: quote.catalogue_selections as never,
      quote_lines: quote.lines as never,
      subtotal_idr: quote.subtotal_idr,
      season_discount_idr: quote.season_discount_idr,
      promo_discount_idr: quote.promo_discount_idr,
      total_idr: quote.total_idr,
      season_month: quote.month,
      season_period: quote.season_period,
      promo_code: quote.promo_code,
      promo_code_id: quote.promo_code_id,
      quoted_at: new Date().toISOString(),
    })
    .eq("id", args.packageId)
    .select(PACKAGE_FIELDS)
    .single();
  if (error || !updated) fail(SAFE_ERROR);

  return { pkg: updated, quote };
}

/** Marks a Package complete only when valid, priced and purchasable. */
export async function completePackage(packageId: string, token?: string) {
  const cart = await currentCart(false, token);
  if (!cart) fail("Your cart could not be found.");
  await assertPackageInCart(cart.id, packageId);

  const db = await admin();
  const { data: pkg } = await db
    .from("packages")
    .select("id, product_id, status, answers, season_month, promo_code")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) fail("This package could not be found.");
  if (pkg.status === "complete") return { pkg, alreadyComplete: true };

  const quote = await quotePackage({
    productId: pkg.product_id,
    answers: (pkg.answers ?? {}) as PreviewValues,
    month: pkg.season_month,
    promoCode: pkg.promo_code,
    isGift: false,
  });
  if (!quote.purchasable) fail("This product is not available for purchase yet.");
  if (quote.configuration_issues.length > 0) fail(quote.configuration_issues[0]!);
  if (quote.errors.length > 0) fail(quote.errors[0]!);

  const { data: updated, error } = await db
    .from("packages")
    .update({
      status: "complete",
      answers: quote.answers as never,
      resolved_inputs: quote.resolved_inputs as never,
      catalogue_selections: quote.catalogue_selections as never,
      quote_lines: quote.lines as never,
      subtotal_idr: quote.subtotal_idr,
      season_discount_idr: quote.season_discount_idr,
      promo_discount_idr: quote.promo_discount_idr,
      total_idr: quote.total_idr,
      season_month: quote.month,
      season_period: quote.season_period,
      promo_code: quote.promo_code,
      promo_code_id: quote.promo_code_id,
      quoted_at: new Date().toISOString(),
    })
    .eq("id", packageId)
    .eq("status", "draft")
    .select(PACKAGE_FIELDS)
    .single();
  if (error || !updated) fail(SAFE_ERROR);
  return { pkg: updated, alreadyComplete: false };
}

/** Cart contents. Only complete packages contribute to the payable total. */
export async function listCart(token?: string) {
  const cart = await currentCart(false, token);
  if (!cart) {
    return { cart: null, packages: [], draft: null, payable_total_idr: 0 };
  }
  const db = await admin();
  const { data } = await db
    .from("cart_packages")
    .select(`position, packages!inner(${PACKAGE_FIELDS})`)
    .eq("cart_id", cart.id)
    .order("position");

  const rows = (data ?? []).map((r: any) => ({ position: r.position, ...r.packages }));
  const complete = rows.filter((p: any) => p.status === "complete");
  const draft = rows.find((p: any) => p.status === "draft") ?? null;
  return {
    cart,
    packages: complete,
    draft,
    payable_total_idr: complete.reduce((sum: number, p: any) => sum + Number(p.total_idr), 0),
  };
}

/** Removes a complete package. Other packages are untouched. */
export async function removePackage(packageId: string, token?: string) {
  const cart = await currentCart(false, token);
  if (!cart) fail("Your cart could not be found.");
  await assertPackageInCart(cart.id, packageId);

  const db = await admin();
  const { data: pkg } = await db.from("packages").select("id, status").eq("id", packageId).maybeSingle();
  if (!pkg) fail("This package could not be found.");
  if (pkg.status !== "complete") fail("Only a completed package can be removed from the cart.");

  const { error } = await db.from("packages").delete().eq("id", packageId);
  if (error) fail(SAFE_ERROR);
  return { ok: true };
}

/** Discards the in-progress package so a new one can be started. */
export async function discardDraft(token?: string) {
  const cart = await currentCart(false, token);
  if (!cart) return { ok: true };
  const draft = await getDraft(cart.id);
  if (!draft) return { ok: true };
  const db = await admin();
  await db.from("packages").delete().eq("id", draft.id);
  return { ok: true };
}

/** The current draft package, if any. */
export async function continueDraft(token?: string) {
  const cart = await currentCart(false, token);
  if (!cart) return { draft: null };
  return { draft: await getDraft(cart.id) };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Catalog server operations that must be atomic or validated server-side:
 * product creation, duplication (deep, independent copy) and status changes.
 * Simple single-row edits stay in the UI through RLS, exactly as Phase 2.
 */

const SAFE_ERROR = "This action could not be completed. Please check your input and try again.";

class CatalogError extends Error {}
function fail(message: string): never {
  throw new CatalogError(message);
}

type AuthedContext = { supabase: any; userId: string };

function ctx(context: unknown): AuthedContext {
  return context as AuthedContext;
}

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(SAFE_ERROR);
  if (data !== true) fail("Only an ADMIN may change product configuration.");
}

async function audit(
  supabase: any,
  actorId: string,
  action: string,
  entityId: string | null,
  entityRef: string | null,
  details: Record<string, unknown>,
) {
  await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "products",
    entity_id: entityId,
    entity_ref: entityRef,
    details: details as never,
  });
}

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        internal_name: z.string().min(1, "An internal name is required.").max(200),
        kind: z.enum(["package", "insurance"]),
        internal_ref: z.string().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        internal_name: data.internal_name.trim(),
        kind: data.kind,
        internal_ref: data.internal_ref?.trim() || null,
        status: "draft",
      })
      .select("id, internal_name")
      .single();
    if (error || !product) fail("This product could not be created. The reference may already be in use.");

    const { error: flowError } = await supabase
      .from("config_flows")
      .insert({ product_id: product.id });
    const { error: contentError } = await supabase
      .from("product_translations")
      .insert({ product_id: product.id, language_code: "en" });
    if (flowError || contentError) {
      // Leave nothing half-built behind.
      await supabase.from("products").delete().eq("id", product.id);
      fail("This product could not be created. Please try again.");
    }

    await audit(supabase, userId, "product_created", product.id, product.internal_name, {
      kind: data.kind,
    });
    return { id: product.id as string };
  });

export const duplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);
    const src = data.productId;

    const { data: original, error } = await supabase
      .from("products")
      .select("internal_name")
      .eq("id", src)
      .maybeSingle();
    if (error || !original) fail("This product could not be found.");

    // One database transaction copies the whole product tree (content,
    // categories, placements and their order, components with their template
    // traceability, flow, steps, fields, options and dependencies). Any
    // failure inside it rolls the entire duplicate back.
    const { data: newId, error: dupError } = await supabase.rpc("duplicate_product", {
      _source: src,
    });
    if (dupError || !newId) fail(SAFE_ERROR);

    await audit(supabase, userId, "product_duplicated", newId as string, original.internal_name, {
      source_product_id: src,
    });
    return { id: newId as string };
  });

/**
 * Activation gate recomputed on the server. The browser also shows these
 * problems, but the server never trusts the browser's verdict.
 */
async function assertActivatable(supabase: any, productId: string) {
  const [{ data: translation }, { data: flow }, { data: fields }] = await Promise.all([
    supabase
      .from("product_translations")
      .select("title")
      .eq("product_id", productId)
      .eq("language_code", "en")
      .maybeSingle(),
    supabase.from("config_flows").select("id").eq("product_id", productId).maybeSingle(),
    supabase
      .from("fields")
      .select("id, step_id, variable_name, field_type, is_active, internal_name, option_source, catalogue_type, catalogue_id")
      .eq("product_id", productId),
  ]);

  if (!translation?.title?.trim()) fail("Add an English title before activating this product.");
  if (!flow) fail("This product has no configurator flow and cannot be activated.");

  const { data: steps } = await supabase
    .from("steps")
    .select("id, is_active")
    .eq("flow_id", flow.id);
  const activeSteps = (steps ?? []).filter((s: any) => s.is_active);
  if (activeSteps.length === 0) fail("Add at least one active step before activating.");

  const activeFields = (fields ?? []).filter(
    (f: any) => f.is_active && activeSteps.some((s: any) => s.id === f.step_id),
  );
  const names = activeFields.map((f: any) => f.variable_name);
  if (new Set(names).size !== names.length) {
    fail("Two questions share the same variable name. Fix that before activating.");
  }

  const selectFields = activeFields.filter((f: any) =>
    ["single_select", "multi_select"].includes(f.field_type),
  );
  if (selectFields.length) {
    const { data: options } = await supabase
      .from("field_options")
      .select("field_id, is_active")
      .in(
        "field_id",
        selectFields.map((f: any) => f.id),
      );

    // Catalogue-backed questions take their choices from the existing
    // Catalogue Bridge, so they are validated against live active items.
    const { fieldCatalogueKey, fieldCatalogueRefs } = await import("@/lib/catalogue-bridge");
    const refs = fieldCatalogueRefs(selectFields as never);
    let items: Record<string, unknown[]> = {};
    if (refs.length) {
      const { resolveCatalogues } = await import("@/lib/catalogue-bridge.server");
      items = (await resolveCatalogues(refs)) as never;
    }

    const { selectFieldActivationError } = await import("@/lib/catalog");
    for (const f of selectFields) {
      const key = fieldCatalogueKey(f);
      const problem = selectFieldActivationError(f, {
        activeManualOptions: (options ?? []).filter((o: any) => o.field_id === f.id && o.is_active)
          .length,
        catalogueItems: key ? (items[key]?.length ?? 0) : 0,
      });
      if (problem) fail(problem);
    }
  }
}


export const setProductStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().uuid(),
        status: z.enum(["draft", "active", "inactive", "archived"]),
        errorCount: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    if (data.status === "active") await assertActivatable(supabase, data.productId);


    const { data: updated, error } = await supabase
      .from("products")
      .update({ status: data.status })
      .eq("id", data.productId)
      .select("internal_name")
      .single();
    if (error || !updated) fail(SAFE_ERROR);

    await audit(supabase, userId, "product_status_changed", data.productId, updated.internal_name, {
      status: data.status,
    });
    return { ok: true };
  });

export const addComponentFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().uuid(), templateId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = ctx(context);
    await assertAdmin(supabase);

    const { data: tpl, error } = await supabase
      .from("component_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();
    if (error || !tpl) fail("This template could not be found.");

    const { count } = await supabase
      .from("product_components")
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.productId);

    // Values are COPIED. The new component is independent of the template.
    const { error: insertError } = await supabase.from("product_components").insert({
      product_id: data.productId,
      source_template_id: tpl.id,
      internal_name: tpl.internal_name,
      customer_name: tpl.customer_name,
      customer_description: tpl.customer_description,
      unit_basis: tpl.unit_basis,
      internal_cost: tpl.internal_cost,
      customer_price: tpl.customer_price,
      min_quantity: tpl.min_quantity,
      max_quantity: tpl.max_quantity,
      default_quantity: tpl.default_quantity,
      season_eligible: tpl.season_eligible,
      promo_eligible: tpl.promo_eligible,
      display_order: count ?? 0,
    });
    if (insertError) fail(SAFE_ERROR);

    await audit(supabase, userId, "product_component_added", data.productId, tpl.internal_name, {
      from_template: tpl.id,
    });
    return { ok: true };
  });

/**
 * Active, customer-safe catalogue items for the Admin preview, resolved by the
 * existing Generic Catalogue Bridge resolver (same data the public
 * configurator receives). Read-only; no new catalogue logic.
 */
export const previewCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        refs: z.array(
          z.object({
            catalogue_type: z.enum(["accommodation_room", "transport", "motorbike"]),
            catalogue_id: z.string().uuid().nullable(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { resolveCatalogues } = await import("@/lib/catalogue-bridge.server");
    return await resolveCatalogues(data.refs);
  });

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

    await supabase.from("config_flows").insert({ product_id: product.id });
    await supabase
      .from("product_translations")
      .insert({ product_id: product.id, language_code: "en" });

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
      .select("*")
      .eq("id", src)
      .single();
    if (error || !original) fail("This product could not be found.");

    const { data: copy, error: copyError } = await supabase
      .from("products")
      .insert({
        kind: original.kind,
        internal_name: `Copy of ${original.internal_name}`.slice(0, 200),
        internal_ref: null,
        status: "draft",
        sort_order: original.sort_order,
      })
      .select("id")
      .single();
    if (copyError || !copy) fail(SAFE_ERROR);
    const newId = copy.id as string;

    // Content
    const { data: translations } = await supabase
      .from("product_translations")
      .select("*")
      .eq("product_id", src);
    if (translations?.length) {
      await supabase.from("product_translations").insert(
        translations.map((t: any) => ({
          product_id: newId,
          language_code: t.language_code,
          title: t.title,
          summary: t.summary,
          body: t.body,
          seo_title: t.seo_title,
          seo_description: t.seo_description,
        })),
      );
    }

    // Categories and placements
    const { data: cats } = await supabase
      .from("product_categories")
      .select("category_id")
      .eq("product_id", src);
    if (cats?.length) {
      await supabase
        .from("product_categories")
        .insert(cats.map((c: any) => ({ product_id: newId, category_id: c.category_id })));
    }
    const { data: places } = await supabase
      .from("product_placements")
      .select("placement_id, display_order")
      .eq("product_id", src);
    if (places?.length) {
      await supabase.from("product_placements").insert(
        places.map((p: any) => ({
          product_id: newId,
          placement_id: p.placement_id,
          display_order: p.display_order,
        })),
      );
    }

    // Components (independent copies)
    const { data: components } = await supabase
      .from("product_components")
      .select("*")
      .eq("product_id", src);
    if (components?.length) {
      await supabase.from("product_components").insert(
        components.map((c: any) => ({
          product_id: newId,
          source_template_id: c.source_template_id,
          internal_name: c.internal_name,
          customer_name: c.customer_name,
          customer_description: c.customer_description,
          unit_basis: c.unit_basis,
          internal_cost: c.internal_cost,
          customer_price: c.customer_price,
          min_quantity: c.min_quantity,
          max_quantity: c.max_quantity,
          default_quantity: c.default_quantity,
          season_eligible: c.season_eligible,
          promo_eligible: c.promo_eligible,
          display_order: c.display_order,
          is_active: c.is_active,
        })),
      );
    }

    // Configurator: flow -> steps -> fields -> options, then dependencies
    const { data: newFlow, error: flowError } = await supabase
      .from("config_flows")
      .insert({ product_id: newId })
      .select("id")
      .single();
    if (flowError || !newFlow) fail(SAFE_ERROR);

    const stepMap = new Map<string, string>();
    const fieldMap = new Map<string, string>();
    const optionMap = new Map<string, string>();

    const { data: oldFlow } = await supabase
      .from("config_flows")
      .select("id, internal_name, is_active")
      .eq("product_id", src)
      .maybeSingle();

    if (oldFlow) {
      await supabase
        .from("config_flows")
        .update({ internal_name: oldFlow.internal_name, is_active: oldFlow.is_active })
        .eq("id", newFlow.id);

      const { data: steps } = await supabase
        .from("steps")
        .select("*")
        .eq("flow_id", oldFlow.id)
        .order("display_order");
      for (const s of steps ?? []) {
        const { data: ns } = await supabase
          .from("steps")
          .insert({
            flow_id: newFlow.id,
            internal_name: s.internal_name,
            customer_title: s.customer_title,
            customer_description: s.customer_description,
            display_order: s.display_order,
            is_active: s.is_active,
          })
          .select("id")
          .single();
        if (ns) stepMap.set(s.id, ns.id);
      }
    }

    const { data: fields } = await supabase
      .from("fields")
      .select("*")
      .eq("product_id", src)
      .order("display_order");
    for (const f of fields ?? []) {
      const newStepId = stepMap.get(f.step_id);
      if (!newStepId) continue;
      const { data: nf } = await supabase
        .from("fields")
        .insert({
          product_id: newId,
          step_id: newStepId,
          internal_name: f.internal_name,
          variable_name: f.variable_name,
          customer_label: f.customer_label,
          help_text: f.help_text,
          field_type: f.field_type,
          is_required: f.is_required,
          is_active: f.is_active,
          default_value: f.default_value,
          min_value: f.min_value,
          max_value: f.max_value,
          display_order: f.display_order,
        })
        .select("id")
        .single();
      if (!nf) continue;
      fieldMap.set(f.id, nf.id);

      const { data: options } = await supabase
        .from("field_options")
        .select("*")
        .eq("field_id", f.id)
        .order("display_order");
      for (const o of options ?? []) {
        const { data: no } = await supabase
          .from("field_options")
          .insert({
            field_id: nf.id,
            internal_value: o.internal_value,
            customer_label: o.customer_label,
            description: o.description,
            display_order: o.display_order,
            is_active: o.is_active,
            is_default: o.is_default,
          })
          .select("id")
          .single();
        if (no) optionMap.set(o.id, no.id);
      }
    }

    const { data: deps } = await supabase.from("dependencies").select("*").eq("product_id", src);
    const rows = (deps ?? [])
      .map((d: any) => {
        const sourceField = fieldMap.get(d.source_field_id);
        if (!sourceField) return null;
        const targetField = d.target_field_id ? fieldMap.get(d.target_field_id) : null;
        const targetOption = d.target_option_id ? optionMap.get(d.target_option_id) : null;
        if (!targetField && !targetOption) return null;
        return {
          product_id: newId,
          source_field_id: sourceField,
          source_option_id: d.source_option_id ? optionMap.get(d.source_option_id) ?? null : null,
          operator: d.operator,
          compare_value: d.compare_value,
          action: d.action,
          action_value: d.action_value,
          target_field_id: targetField ?? null,
          target_option_id: targetOption ?? null,
          is_active: d.is_active,
        };
      })
      .filter(Boolean);
    if (rows.length) await supabase.from("dependencies").insert(rows);

    await audit(supabase, userId, "product_duplicated", newId, original.internal_name, {
      source_product_id: src,
    });
    return { id: newId };
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
      .select("id, step_id, variable_name, field_type, is_active")
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
    for (const f of selectFields) {
      const has = (options ?? []).some((o: any) => o.field_id === f.id && o.is_active);
      if (!has) fail("Every choice question needs at least one active option before activating.");
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

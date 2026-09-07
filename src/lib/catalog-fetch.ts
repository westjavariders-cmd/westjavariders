import { supabase } from "@/integrations/supabase/client";

import { MASTER_LANGUAGE, type ProductBundle } from "@/lib/catalog";

/** Reads a product's full configuration through the browser client, so RLS stays authoritative. */
function unwrap<D>(res: { data: D | null; error: { message: string } | null }): D {
  if (res.error) throw new Error(res.error.message);
  return res.data as D;
}

export async function fetchProductBundle(productId: string): Promise<ProductBundle> {
  const product = unwrap(
    await supabase.from("products").select("*").eq("id", productId).single(),
  );
  if (!product) throw new Error("This product no longer exists.");
  const [translation, cats, places, components, flow] = await Promise.all([
    supabase
      .from("product_translations")
      .select("*")
      .eq("product_id", productId)
      .eq("language_code", MASTER_LANGUAGE)
      .maybeSingle(),
    supabase.from("product_categories").select("category_id").eq("product_id", productId),
    supabase
      .from("product_placements")
      .select("placement_id, display_order")
      .eq("product_id", productId)
      .order("display_order"),
    supabase
      .from("product_components")
      .select("*")
      .eq("product_id", productId)
      .order("display_order"),
    supabase.from("config_flows").select("*").eq("product_id", productId).maybeSingle(),
  ]);

  const flowRow = unwrap(flow);
  const steps = flowRow
    ? unwrap(
        await supabase.from("steps").select("*").eq("flow_id", flowRow.id).order("display_order"),
      )
    : [];
  const fields = unwrap(
    await supabase.from("fields").select("*").eq("product_id", productId).order("display_order"),
  );
  const fieldIds = fields.map((f) => f.id);
  const options = fieldIds.length
    ? unwrap(
        await supabase
          .from("field_options")
          .select("*")
          .in("field_id", fieldIds)
          .order("display_order"),
      )
    : [];
  const dependencies = unwrap(
    await supabase.from("dependencies").select("*").eq("product_id", productId),
  );

  return {
    product,
    translation: unwrap(translation),
    categoryIds: unwrap(cats).map((r) => r.category_id),
    placements: unwrap(places),
    components: unwrap(components),
    flow: flowRow,
    steps,
    fields,
    options,
    dependencies,
  };
}

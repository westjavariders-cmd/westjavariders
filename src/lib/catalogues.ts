import type { Database } from "@/integrations/supabase/types";
import type { CatalogueType } from "@/lib/catalogue-bridge";

/**
 * Catalogues: the manageable containers. Each one is built from one of the
 * three existing structural templates, and holds its own items. Nothing here
 * prices anything; the pricing engine stays untouched.
 */

export type Catalogue = Database["public"]["Tables"]["catalogues"]["Row"];

export const CATALOGUE_TEMPLATES = ["accommodation", "transport", "motorbike"] as const;
export type CatalogueTemplate = (typeof CATALOGUE_TEMPLATES)[number];

export const CATALOGUE_TEMPLATE_LABELS: Record<CatalogueTemplate, string> = {
  accommodation: "Accommodation (properties, rooms, photos)",
  transport: "Transport (prices per people and per hours)",
  motorbike: "Simple item (one price, one photo)",
};

/** Short label used in lists. */
export const CATALOGUE_TEMPLATE_SHORT: Record<CatalogueTemplate, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  motorbike: "Simple item",
};

/** Which configurator catalogue type a template exposes to the bridge. */
export const CATALOGUE_TYPE_OF_TEMPLATE: Record<CatalogueTemplate, CatalogueType> = {
  accommodation: "accommodation_room",
  transport: "transport",
  motorbike: "motorbike",
};

/** Reverse mapping, used by the server resolver. */
export const CATALOGUE_TEMPLATE_OF_TYPE: Record<CatalogueType, CatalogueTemplate> = {
  accommodation_room: "accommodation",
  transport: "transport",
  motorbike: "motorbike",
};

/** Admin list route that manages the items of a given template. */
export function catalogueItemsRoute(template: CatalogueTemplate): string {
  switch (template) {
    case "accommodation":
      return "/admin/hotels";
    case "transport":
      return "/admin/transport";
    case "motorbike":
      return "/admin/motorbikes";
  }
}

export function catalogueLabel(c: Pick<Catalogue, "internal_name" | "public_name">): string {
  return c.public_name?.trim() || c.internal_name;
}

export function validateCatalogue(input: {
  internal_name: string;
  template: string;
}): string[] {
  const issues: string[] = [];
  if (!input.internal_name.trim()) issues.push("An internal name is required.");
  if (!CATALOGUE_TEMPLATES.includes(input.template as CatalogueTemplate)) {
    issues.push("Choose one of the available catalogue templates.");
  }
  return issues;
}

/**
 * The catalogue an item belongs to. When no catalogue is given, the first
 * catalogue of that structure is used, so existing Admin screens keep working
 * exactly as before catalogues became manageable.
 */
export async function resolveCatalogueId(
  supabase: any,
  template: CatalogueTemplate,
  catalogueId?: string | null,
): Promise<string | null> {
  if (catalogueId) {
    const { data } = await supabase
      .from("catalogues")
      .select("id, template")
      .eq("id", catalogueId)
      .maybeSingle();
    if (!data || data.template !== template) return null;
    return data.id as string;
  }
  const { data } = await supabase
    .from("catalogues")
    .select("id")
    .eq("template", template)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

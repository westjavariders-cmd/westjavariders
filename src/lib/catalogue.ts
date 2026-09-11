/**
 * Catalogue instances.
 *
 * A catalogue is an INSTANCE of one of three fixed templates. A template is a
 * behaviour, not a schema: per-night rooms, a people x hours grid, or a flat
 * item price. Creating a catalogue never creates new behaviour, so no schema
 * builder and no new pricing engine live here.
 */

import type { CatalogueType } from "@/lib/catalogue-bridge";

export const CATALOGUE_TEMPLATES = ["accommodation", "transport", "motorbike"] as const;
export type CatalogueTemplate = (typeof CATALOGUE_TEMPLATES)[number];

export const CATALOGUE_TEMPLATE_LABELS: Record<CatalogueTemplate, string> = {
  accommodation: "Accommodation (rooms priced per night)",
  transport: "Transport (price by people and travel time)",
  motorbike: "Simple items (one price per item)",
};

/** Where the Admin editor for a template lives. */
export const CATALOGUE_TEMPLATE_ROUTES: Record<CatalogueTemplate, string> = {
  accommodation: "/admin/hotels",
  transport: "/admin/transport",
  motorbike: "/admin/motorbikes",
};

/** The bridge type a template's items are offered through. */
export const TEMPLATE_CATALOGUE_TYPE: Record<CatalogueTemplate, CatalogueType> = {
  accommodation: "accommodation_room",
  transport: "transport",
  motorbike: "motorbike",
};

export function templateForCatalogueType(type: CatalogueType): CatalogueTemplate {
  const found = CATALOGUE_TEMPLATES.find((t) => TEMPLATE_CATALOGUE_TYPE[t] === type);
  return (found ?? "motorbike") as CatalogueTemplate;
}

export type Catalogue = {
  id: string;
  template: CatalogueTemplate;
  internal_name: string;
  public_name: string | null;
  description: string | null;
  active: boolean;
  sort_order: number;
};

export function isCatalogueTemplate(value: unknown): value is CatalogueTemplate {
  return CATALOGUE_TEMPLATES.includes(value as CatalogueTemplate);
}

export function validateCatalogue(input: { internal_name: string; template: string }): string[] {
  const issues: string[] = [];
  if (input.internal_name.trim() === "") issues.push("An internal name is required.");
  if (!isCatalogueTemplate(input.template)) issues.push("The catalogue template is not valid.");
  return issues;
}

/** Customer-facing name, with the internal name as the fallback. */
export function cataloguePublicName(catalogue: Pick<Catalogue, "internal_name" | "public_name">) {
  return catalogue.public_name?.trim() || catalogue.internal_name;
}

/** Catalogues offerable to customers through a given bridge type. */
export function cataloguesForType(catalogues: Catalogue[], type: CatalogueType): Catalogue[] {
  const template = templateForCatalogueType(type);
  return catalogues.filter((c) => c.template === template);
}

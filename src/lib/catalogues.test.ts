import { describe, expect, it } from "vitest";

import {
  catalogueKey,
  fieldCatalogueKey,
  fieldCatalogueRefs,
  resolveCatalogueSelections,
  stripInvalidCatalogueAnswers,
  toCatalogueItem,
  type CatalogueItemsByKey,
} from "./catalogue-bridge";
import {
  CATALOGUE_TEMPLATE_OF_TYPE,
  CATALOGUE_TYPE_OF_TEMPLATE,
  catalogueItemsRoute,
  catalogueLabel,
  validateCatalogue,
} from "./catalogues";

const field = (id: string, variable: string, catalogueId: string | null) => ({
  id,
  variable_name: variable,
  field_type: "single_select",
  option_source: "catalogue",
  catalogue_type: "motorbike",
  catalogue_id: catalogueId,
});

const item = (id: string, catalogueId: string | null, price: number) =>
  toCatalogueItem("motorbike", { id, catalogue_id: catalogueId, name: `Item ${id}`, customer_price_idr: price });

describe("catalogue containers", () => {
  it("keys a specific catalogue by id and a legacy field by template", () => {
    expect(catalogueKey({ catalogue_type: "motorbike", catalogue_id: "c1" })).toBe("c1");
    expect(catalogueKey({ catalogue_type: "motorbike", catalogue_id: null })).toBe("motorbike");
  });

  it("maps templates and configurator types both ways", () => {
    expect(CATALOGUE_TYPE_OF_TEMPLATE.accommodation).toBe("accommodation_room");
    expect(CATALOGUE_TEMPLATE_OF_TYPE.accommodation_room).toBe("accommodation");
    expect(catalogueItemsRoute("motorbike")).toBe("/admin/motorbikes");
  });

  it("requires a name and one of the three structures", () => {
    expect(validateCatalogue({ internal_name: "", template: "motorbike" })).toHaveLength(1);
    expect(validateCatalogue({ internal_name: "Bikes", template: "spaceship" })).toHaveLength(1);
    expect(validateCatalogue({ internal_name: "Bikes", template: "motorbike" })).toEqual([]);
  });

  it("prefers the customer-facing name in labels", () => {
    expect(catalogueLabel({ internal_name: "Bikes", public_name: "Our scooters" })).toBe("Our scooters");
    expect(catalogueLabel({ internal_name: "Bikes", public_name: null })).toBe("Bikes");
  });

  it("collects one reference per distinct catalogue, not per template", () => {
    const refs = fieldCatalogueRefs([
      field("f1", "bike_a", "c1"),
      field("f2", "bike_b", "c2"),
      field("f3", "bike_c", "c1"),
      { ...field("f4", "manual", null), option_source: "manual", catalogue_type: null },
    ] as never);
    expect(refs.map(catalogueKey)).toEqual(["c1", "c2"]);
  });

  it("keeps two catalogues of the same structure completely separate", () => {
    const items: CatalogueItemsByKey = {
      c1: [item("a", "c1", 100000)],
      c2: [item("b", "c2", 250000)],
    };
    const fields = [field("f1", "bike_a", "c1"), field("f2", "bike_b", "c2")] as never;

    // An item of catalogue 2 is not a valid answer for a field reading catalogue 1.
    const stripped = stripInvalidCatalogueAnswers(fields, { bike_a: "b", bike_b: "b" }, items);
    expect(stripped).toEqual({ bike_a: "", bike_b: "b" });

    const { selections, invalid } = resolveCatalogueSelections(
      fields,
      { bike_a: "a", bike_b: "b" },
      items,
    );
    expect(invalid).toEqual([]);
    expect(selections.map((s) => [s.variable_name, s.catalogue_id, s.customer_price_idr])).toEqual([
      ["bike_a", "c1", 100000],
      ["bike_b", "c2", 250000],
    ]);
  });

  it("still resolves a legacy field that only names a template", () => {
    const legacy = { ...field("f1", "bike", null) } as never;
    expect(fieldCatalogueKey(legacy)).toBe("motorbike");
    const { selections } = resolveCatalogueSelections(
      [legacy],
      { bike: "a" },
      { motorbike: [item("a", "c1", 90000)] },
    );
    expect(selections[0]?.catalogue_id).toBe("c1");
  });
});

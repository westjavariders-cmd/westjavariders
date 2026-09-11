import { describe, expect, it } from "vitest";

import {
  CATALOGUE_TEMPLATES,
  cataloguePublicName,
  cataloguesForType,
  isCatalogueTemplate,
  TEMPLATE_CATALOGUE_TYPE,
  templateForCatalogueType,
  validateCatalogue,
} from "@/lib/catalogue";
import { itemsForField, toCatalogueItem } from "@/lib/catalogue-bridge";

const catalogue = (id: string, template: (typeof CATALOGUE_TEMPLATES)[number], name = id) => ({
  id,
  template,
  internal_name: name,
  public_name: null,
  description: null,
  active: true,
  sort_order: 0,
});

describe("catalogue templates", () => {
  it("keeps exactly the three existing behaviours", () => {
    expect([...CATALOGUE_TEMPLATES]).toEqual(["accommodation", "transport", "motorbike"]);
    expect(isCatalogueTemplate("accommodation")).toBe(true);
    expect(isCatalogueTemplate("boat")).toBe(false);
  });

  it("maps every template to a bridge type and back", () => {
    for (const template of CATALOGUE_TEMPLATES) {
      expect(templateForCatalogueType(TEMPLATE_CATALOGUE_TYPE[template])).toBe(template);
    }
    expect(TEMPLATE_CATALOGUE_TYPE.accommodation).toBe("accommodation_room");
  });

  it("validates the name and the template", () => {
    expect(validateCatalogue({ internal_name: "Hotels", template: "accommodation" })).toEqual([]);
    expect(validateCatalogue({ internal_name: " ", template: "accommodation" })).toHaveLength(1);
    expect(validateCatalogue({ internal_name: "Hotels", template: "boat" })).toHaveLength(1);
  });

  it("falls back to the internal name for public display", () => {
    expect(cataloguePublicName({ internal_name: "Hotels", public_name: null })).toBe("Hotels");
    expect(cataloguePublicName({ internal_name: "Hotels", public_name: " Stays " })).toBe("Stays");
    expect(cataloguePublicName({ internal_name: "Hotels", public_name: "   " })).toBe("Hotels");
  });

  it("offers only the catalogues matching a bridge type", () => {
    const all = [
      catalogue("a", "accommodation"),
      catalogue("t", "transport"),
      catalogue("m", "motorbike"),
    ];
    expect(cataloguesForType(all, "accommodation_room").map((c) => c.id)).toEqual(["a"]);
    expect(cataloguesForType(all, "motorbike").map((c) => c.id)).toEqual(["m"]);
  });
});

describe("catalogue instance scoping of a question", () => {
  const item = (id: string, catalogueId: string | null) =>
    toCatalogueItem("motorbike", {
      id,
      name: id,
      customer_price_idr: 100000,
      catalogue_id: catalogueId,
    });

  const items = {
    motorbike: [item("one", "c1"), item("two", "c2"), item("legacy", null)],
  };
  const base = {
    id: "f1",
    variable_name: "bike",
    field_type: "single_select",
    option_source: "catalogue",
    catalogue_type: "motorbike",
  };

  it("offers every item of the kind when no catalogue is named", () => {
    expect(itemsForField(base, items).map((i) => i.id)).toEqual(["one", "two", "legacy"]);
    expect(itemsForField({ ...base, catalogue_id: null }, items)).toHaveLength(3);
  });

  it("offers only the named catalogue's items", () => {
    expect(itemsForField({ ...base, catalogue_id: "c2" }, items).map((i) => i.id)).toEqual(["two"]);
  });

  it("offers nothing for a manual question", () => {
    expect(itemsForField({ ...base, option_source: "manual", catalogue_type: null }, items)).toEqual(
      [],
    );
  });
});

describe("resolveCatalogueOwner", () => {
  function db(row: unknown) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
        }),
      }),
    } as never;
  }

  it("keeps items unassigned when no catalogue is chosen", async () => {
    await expect(resolveCatalogueOwner(db(null), null, "motorbike")).resolves.toBeNull();
    await expect(resolveCatalogueOwner(db(null), undefined, "accommodation")).resolves.toBeNull();
  });

  it("assigns the item to the chosen catalogue", async () => {
    await expect(
      resolveCatalogueOwner(db({ id: "c1", template: "motorbike" }), "c1", "motorbike"),
    ).resolves.toBe("c1");
  });

  it("refuses a catalogue of another behaviour", async () => {
    await expect(
      resolveCatalogueOwner(db({ id: "c1", template: "accommodation" }), "c1", "motorbike"),
    ).rejects.toThrow(/does not accept/);
  });

  it("refuses a catalogue that does not exist", async () => {
    await expect(resolveCatalogueOwner(db(null), "missing", "transport")).rejects.toThrow(
      /could not be found/,
    );
  });
});

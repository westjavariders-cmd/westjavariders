import { describe, expect, it } from "vitest";

import {
  cataloguePriceVariable,
  cataloguePriceVariables,
  fieldCatalogueType,
  isCatalogueField,
  resolveCatalogueSelections,
  stripInvalidCatalogueAnswers,
  toCatalogueItem,
  type CatalogueItem,
} from "./catalogue-bridge";

const room = (id: string, price: number | null = 500000): CatalogueItem => ({
  catalogue_type: "accommodation_room",
  id,
  name: `Room ${id}`,
  reference: null,
  description: null,
  photo_url: null,
  customer_price_idr: price,
});

const manualField = { id: "f1", variable_name: "extras", field_type: "single_select" };
const catalogueField = {
  id: "f2",
  variable_name: "room",
  field_type: "single_select",
  option_source: "catalogue",
  catalogue_type: "accommodation_room",
};

describe("catalogue bridge field source", () => {
  it("treats a field with no source as manual", () => {
    expect(isCatalogueField(manualField)).toBe(false);
    expect(fieldCatalogueType(manualField)).toBeNull();
  });

  it("recognises a configured catalogue field", () => {
    expect(isCatalogueField(catalogueField)).toBe(true);
    expect(fieldCatalogueType(catalogueField)).toBe("accommodation_room");
  });

  it("ignores a catalogue source with no catalogue chosen", () => {
    expect(isCatalogueField({ ...catalogueField, catalogue_type: null })).toBe(false);
  });
});

describe("customer-safe projection", () => {
  it("keeps only contract fields", () => {
    const item = toCatalogueItem("motorbike", {
      id: "m1",
      name: "Scooter",
      customer_price_idr: 90000,
      supplier_cost_idr: 40000,
      internal_notes: "secret",
      internal_name: "internal",
    });
    expect(item).toEqual({
      catalogue_type: "motorbike",
      id: "m1",
      name: "Scooter",
      reference: null,
      description: null,
      photo_url: null,
      customer_price_idr: 90000,
    });
    expect(JSON.stringify(item)).not.toContain("secret");
  });
});

describe("selection resolution", () => {
  const items = { accommodation_room: [room("a"), room("b", null)] };

  it("snapshots the selected item for historical integrity", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [catalogueField],
      { room: "a" },
      items,
    );
    expect(invalid).toEqual([]);
    expect(selections).toEqual([
      {
        variable_name: "room",
        catalogue_type: "accommodation_room",
        item_id: "a",
        name: "Room a",
        reference: null,
        customer_price_idr: 500000,
      },
    ]);
  });

  it("reports an inactive or unknown choice instead of replacing it", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [catalogueField],
      { room: "gone" },
      items,
      () => "Your room",
    );
    expect(selections).toEqual([]);
    expect(invalid).toEqual([
      "Your choice for Your room is no longer available. Please choose again.",
    ]);
  });

  it("clears only the invalid answer", () => {
    expect(stripInvalidCatalogueAnswers([catalogueField], { room: "gone", nights: 3 }, items)).toEqual(
      { room: "", nights: 3 },
    );
    expect(stripInvalidCatalogueAnswers([catalogueField], { room: "a" }, items)).toEqual({
      room: "a",
    });
  });

  it("leaves manual fields untouched", () => {
    const answers = { extras: "manual_value" };
    expect(stripInvalidCatalogueAnswers([manualField], answers, items)).toEqual(answers);
    expect(resolveCatalogueSelections([manualField], answers, items).selections).toEqual([]);
  });
});

describe("pricing exposure", () => {
  it("names the variable predictably", () => {
    expect(cataloguePriceVariable("room")).toBe("room_price");
  });

  it("sums multi-select prices and skips priceless items", () => {
    expect(
      cataloguePriceVariables([
        { variable_name: "room", catalogue_type: "accommodation_room", item_id: "a", name: "a", reference: null, customer_price_idr: 500000 },
        { variable_name: "room", catalogue_type: "accommodation_room", item_id: "b", name: "b", reference: null, customer_price_idr: 250000 },
        { variable_name: "ride", catalogue_type: "transport", item_id: "t", name: "t", reference: null, customer_price_idr: null },
      ]),
    ).toEqual({ room_price: 750000 });
  });
});

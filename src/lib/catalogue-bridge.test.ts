import { describe, expect, it } from "vitest";

import {
  catalogueItemPriceIdr,
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
  photo_urls: [],
  details: [],
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
      catalogue_id: null,
      id: "m1",
      name: "Scooter",
      reference: null,
      description: null,
      photo_url: null,
      photo_urls: [],
      details: [],
      customer_price_idr: 90000,
      variants: null,
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
        catalogue_id: null,
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
        { variable_name: "room", catalogue_type: "accommodation_room", catalogue_id: null, item_id: "a", name: "a", reference: null, customer_price_idr: 500000 },
        { variable_name: "room", catalogue_type: "accommodation_room", catalogue_id: null, item_id: "b", name: "b", reference: null, customer_price_idr: 250000 },
        { variable_name: "ride", catalogue_type: "transport", item_id: "t", name: "t", reference: null, customer_price_idr: null },
      ]),
    ).toEqual({ room_price: 750000 });
  });
});

describe("catalogue-backed accommodation question", () => {
  const roomField = {
    id: "f3",
    variable_name: "hotelroom",
    field_type: "single_select",
    option_source: "catalogue",
    catalogue_type: "accommodation_room",
  };
  const items = { accommodation_room: [room("active-room", 750000)] };

  it("offers an active room and stores it through the shared bridge shape", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [roomField],
      { hotelroom: "active-room" },
      items,
    );
    expect(invalid).toEqual([]);
    expect(selections[0]).toEqual({
      variable_name: "hotelroom",
      catalogue_type: "accommodation_room",
      catalogue_id: null,
      item_id: "active-room",
      name: "Room active-room",
      reference: null,
      customer_price_idr: 750000,
    });
    expect(cataloguePriceVariables(selections)).toEqual({ hotelroom_price: 750000 });
  });

  it("does not offer a room that is no longer active", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [roomField],
      { hotelroom: "inactive-room" },
      items,
    );
    expect(selections).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("leaves transport and motorbike questions unchanged", () => {
    const transportField = { ...roomField, id: "f4", variable_name: "ride", catalogue_type: "transport" };
    const bikeField = { ...roomField, id: "f5", variable_name: "bike", catalogue_type: "motorbike" };
    expect(fieldCatalogueType(transportField)).toBe("transport");
    expect(fieldCatalogueType(bikeField)).toBe("motorbike");
  });
});

describe("transport catalogue extra choices", () => {
  const item = {
    catalogue_type: "transport" as const,
    catalogue_id: "cat-t",
    id: "t1",
    name: "Airport transfer",
    reference: null,
    description: null,
    photo_url: null,
    photo_urls: [],
    details: [],
    customer_price_idr: null,
    variants: {
      people_label: "Surfers",
      hours_label: "Hours in the van",
      people: [
        { value: 1, price_idr: 500_000 },
        { value: 2, price_idr: 700_000 },
      ],
      hours: [
        { value: 1, price_idr: 100_000 },
        { value: 3, price_idr: 250_000 },
      ],
    },
  };
  const field = {
    id: "f1",
    variable_name: "transfer",
    field_type: "single_select",
    option_source: "catalogue",
    catalogue_type: "transport",
    catalogue_id: "cat-t",
  };
  const items = { "cat-t": [item] };

  it("adds the people price and the hours price", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [field],
      { transfer: "t1", transfer_people: "2", transfer_hours: "3" },
      items,
    );
    expect(invalid).toEqual([]);
    expect(selections[0]!.customer_price_idr).toBe(950_000);
    expect(selections[0]!.people).toBe(2);
    expect(selections[0]!.travel_hours).toBe(3);
    expect(selections[0]!.people_label).toBe("Surfers");
    expect(selections[0]!.hours_label).toBe("Hours in the van");
    expect(cataloguePriceVariables(selections)).toEqual({
      transfer_price: 950_000,
      transfer_people: 2,
      transfer_hours: 3,
    });
  });

  it("asks for the missing choices using the catalogue wording", () => {
    const { selections, invalid } = resolveCatalogueSelections([field], { transfer: "t1" }, items, () => "Transfer");
    expect(selections[0]!.customer_price_idr).toBeNull();
    expect(invalid[0]).toBe("Please choose Surfers and Hours in the van for Transfer.");
  });

  it("drops a choice that the selected item does not offer", () => {
    const next = stripInvalidCatalogueAnswers(
      [field],
      { transfer: "t1", transfer_people: "2", transfer_hours: "9" },
      items,
    );
    expect(next["transfer_people"]).toBe("2");
    expect(next["transfer_hours"]).toBe("");
  });
});

describe("multi-select catalogue extras per item", () => {
  const lesson = {
    catalogue_type: "transport" as const,
    catalogue_id: "cat-a",
    id: "a1",
    name: "Surf lesson",
    reference: null,
    description: null,
    photo_url: null,
    photo_urls: [],
    details: [],
    customer_price_idr: null,
    variants: {
      people_label: "Surfers",
      hours_label: "Days",
      people: [
        { value: 1, price_idr: 400_000 },
        { value: 2, price_idr: 700_000 },
      ],
      hours: [
        { value: 1, price_idr: 1 },
        { value: 2, price_idr: 2 },
      ],
      calc_mode: "multiply" as const,
    },
  };
  const drone = {
    catalogue_type: "transport" as const,
    catalogue_id: "cat-a",
    id: "d1",
    name: "Drone shot",
    reference: null,
    description: null,
    photo_url: null,
    photo_urls: [],
    details: [],
    customer_price_idr: null,
    variants: {
      people_label: "People",
      hours_label: "Days",
      people: [{ value: 1, price_idr: 250_000 }],
      hours: [{ value: 1, price_idr: 1 }, { value: 3, price_idr: 3 }],
      calc_mode: "multiply" as const,
    },
  };
  const field = {
    id: "f1",
    variable_name: "activities",
    field_type: "multi_select",
    option_source: "catalogue",
    catalogue_type: "transport",
    catalogue_id: "cat-a",
  };
  const items = { "cat-a": [lesson, drone] };

  it("prices each selected activity with its own people and days, then sums", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [field],
      {
        activities: ["a1", "d1"],
        activities__a1_people: 2,
        activities__a1_hours: 2,
        activities__d1_people: 1,
        activities__d1_hours: 3,
      },
      items,
    );
    expect(invalid).toEqual([]);
    expect(selections).toHaveLength(2);
    expect(selections[0]!.customer_price_idr).toBe(1_400_000);
    expect(selections[1]!.customer_price_idr).toBe(750_000);
    expect(cataloguePriceVariables(selections)).toEqual({ activities_price: 2_150_000 });
  });

  it("falls back to field-level people and hours for older answers", () => {
    const { selections, invalid } = resolveCatalogueSelections(
      [field],
      { activities: ["a1", "d1"], activities_people: 1, activities_hours: 1 },
      items,
    );
    expect(invalid).toEqual([]);
    expect(selections[0]!.customer_price_idr).toBe(400_000);
    expect(selections[1]!.customer_price_idr).toBe(250_000);
    expect(cataloguePriceVariables(selections)).toEqual({ activities_price: 650_000 });
  });

  it("asks for the missing extras using the activity name", () => {
    const { invalid } = resolveCatalogueSelections(
      [field],
      { activities: ["a1"] },
      items,
      () => "Other activities",
    );
    expect(invalid[0]).toBe("Please choose Surfers and Days for Surf lesson.");
  });

  it("drops extras for an activity that is no longer selected", () => {
    const next = stripInvalidCatalogueAnswers(
      [field],
      {
        activities: ["d1"],
        activities__a1_people: 2,
        activities__a1_hours: 2,
        activities__d1_people: 1,
        activities__d1_hours: 3,
      },
      items,
    );
    expect(next.activities).toEqual(["d1"]);
    expect(next["activities__a1_people"]).toBeUndefined();
    expect(next["activities__a1_hours"]).toBeUndefined();
    expect(next["activities__d1_people"]).toBe(1);
    expect(next["activities__d1_hours"]).toBe(3);
  });
});

describe("transport variant calculation mode", () => {
  const item = {
    catalogue_type: "transport" as const,
    id: "t1",
    name: "Sessions",
    reference: null,
    description: null,
    photo_url: null,
    photo_urls: [],
    details: [],
    customer_price_idr: null,
    variants: {
      people_label: "Number of people",
      hours_label: "Number of days",
      people: [{ value: 2, price_idr: 410000 }],
      hours: [{ value: 3, price_idr: 3 }],
    },
  };

  it("adds both prices by default", () => {
    expect(catalogueItemPriceIdr(item, 2, 3)).toBe(410003);
  });

  it("multiplies both prices when the item is configured that way", () => {
    const multiplied = { ...item, variants: { ...item.variants, calc_mode: "multiply" as const } };
    expect(catalogueItemPriceIdr(multiplied, 2, 3)).toBe(1230000);
  });

  it("still has no price when a required choice is missing", () => {
    const multiplied = { ...item, variants: { ...item.variants, calc_mode: "multiply" as const } };
    expect(catalogueItemPriceIdr(multiplied, 2, null)).toBeNull();
  });
});

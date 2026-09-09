import { describe, expect, it } from "vitest";

import { selectFieldActivationError } from "./catalog";

const base = { id: "f1", internal_name: "Hotel / Room", variable_name: "hotelroom", field_type: "single_select" };
const manual = { ...base, option_source: "manual", catalogue_type: null };
const catalogue = { ...base, option_source: "catalogue", catalogue_type: "accommodation_room" };

describe("choice question activation", () => {
  it("passes a manual question with an active option", () => {
    expect(selectFieldActivationError(manual, { activeManualOptions: 1, catalogueItems: 0 })).toBeNull();
  });

  it("blocks a manual question with no active option", () => {
    expect(selectFieldActivationError(manual, { activeManualOptions: 0, catalogueItems: 5 })).toMatch(
      /active option/,
    );
  });

  it("passes a catalogue question with at least one active catalogue item", () => {
    expect(
      selectFieldActivationError(catalogue, { activeManualOptions: 0, catalogueItems: 3 }),
    ).toBeNull();
  });

  it("blocks a catalogue question with no active catalogue item", () => {
    expect(
      selectFieldActivationError(catalogue, { activeManualOptions: 0, catalogueItems: 0 }),
    ).toMatch(/catalogue/);
  });

  it("blocks a catalogue source with no catalogue chosen", () => {
    expect(
      selectFieldActivationError(
        { ...base, option_source: "catalogue", catalogue_type: null },
        { activeManualOptions: 0, catalogueItems: 9 },
      ),
    ).toMatch(/active option/);
  });

  it("ignores questions that are not choice questions", () => {
    expect(
      selectFieldActivationError(
        { ...base, field_type: "number", option_source: "manual", catalogue_type: null },
        { activeManualOptions: 0, catalogueItems: 0 },
      ),
    ).toBeNull();
  });
});

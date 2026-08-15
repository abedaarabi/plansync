import { describe, expect, it } from "vitest";
import {
  modelQuantityHint,
  pickModelQuantityAndUnit,
  type BimModelQuantityRollup,
} from "./modelQuantity";

const rollup: BimModelQuantityRollup = {
  count: 2,
  length: 3,
  area: 4,
  volume: 1,
};

describe("BIM project quantity display", () => {
  it("uses project display units for unassigned BIM quantities", () => {
    expect(pickModelQuantityAndUnit(rollup, undefined, "METRIC")).toEqual({
      quantity: 1,
      unit: "m³",
    });
    expect(pickModelQuantityAndUnit(rollup, undefined, "IMPERIAL")).toEqual({
      quantity: expect.closeTo(35.314666721),
      unit: "ft³",
    });
  });

  it("keeps a material's explicit unit unchanged", () => {
    expect(pickModelQuantityAndUnit(rollup, "m²", "IMPERIAL")).toEqual({
      quantity: 4,
      unit: "m²",
    });
  });

  it("formats model hints in the project's measurement system", () => {
    expect(modelQuantityHint(rollup, "METRIC")).toContain("4 m²");
    expect(modelQuantityHint(rollup, "IMPERIAL")).toContain("43.06 ft²");
  });
});

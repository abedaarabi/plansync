import { describe, expect, it } from "vitest";
import { modelIdMapHas } from "./modelIdMap";

describe("modelIdMapHas", () => {
  it("returns false for null/undefined maps", () => {
    expect(modelIdMapHas(null, "m1", 1)).toBe(false);
    expect(modelIdMapHas(undefined, "m1", 1)).toBe(false);
  });

  it("returns false when model is missing or id is absent", () => {
    const map = { m1: new Set([10, 20]) };
    expect(modelIdMapHas(map, "m2", 10)).toBe(false);
    expect(modelIdMapHas(map, "m1", 99)).toBe(false);
  });

  it("returns true when the set contains the local id", () => {
    const map = { m1: new Set([10, 20]) };
    expect(modelIdMapHas(map, "m1", 20)).toBe(true);
  });
});

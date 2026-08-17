import { describe, expect, it } from "vitest";
import { canonicalElementMetadata, hashElementMetadata } from "./metadataHash.js";
import type { BimQuantityEntry } from "./types.js";

function sampleEntry(overrides: Partial<BimQuantityEntry> = {}): BimQuantityEntry {
  return {
    expressId: 1,
    guid: "guid-a",
    ifcType: "IfcWall",
    name: "Wall 1",
    level: "Level 01",
    material: "Concrete",
    discipline: "Structure",
    quantities: { area: 12.5 },
    quantitySource: "computed",
    lodFlags: {
      identity: true,
      dimensions: true,
      quantities: true,
      material: true,
      color: false,
    },
    ...overrides,
  };
}

describe("hashElementMetadata", () => {
  it("is stable for the same entry", () => {
    const a = sampleEntry();
    expect(hashElementMetadata(a)).toBe(hashElementMetadata({ ...a }));
  });

  it("changes when a quantity changes", () => {
    const a = sampleEntry();
    const b = sampleEntry({ quantities: { area: 13 } });
    expect(hashElementMetadata(a)).not.toBe(hashElementMetadata(b));
  });

  it("does not change when placement is added (legacy-compatible)", () => {
    const a = sampleEntry();
    const b = sampleEntry({ placement: { x: 1, y: 2, z: 3 } });
    expect(hashElementMetadata(a)).toBe(hashElementMetadata(b));
  });

  it("canonicalizes key order", () => {
    const raw = canonicalElementMetadata(sampleEntry());
    const keys = Object.keys(raw);
    expect(keys).toEqual([...keys].sort());
  });
});

import { describe, expect, it } from "vitest";
import { parseQuantityIndex, normalizeQuantityEntryTypeName } from "./quantityIndexBuilder.js";
import type { BimQuantityEntry } from "./types.js";
import { hashElementMetadata } from "./metadataHash.js";

function baseEntry(overrides: Partial<BimQuantityEntry> = {}): BimQuantityEntry {
  return {
    expressId: 1,
    guid: "guid-a",
    ifcType: "IfcWall",
    name: "Wall 1",
    level: "Level 01",
    material: null,
    discipline: "Structure",
    quantities: {},
    quantitySource: "missing",
    lodFlags: {
      identity: true,
      dimensions: false,
      quantities: false,
      material: false,
      color: false,
    },
    ...overrides,
  };
}

describe("normalizeQuantityEntryTypeName", () => {
  it("fills null for legacy entries missing typeName", () => {
    const legacy = baseEntry();
    delete (legacy as { typeName?: string | null }).typeName;
    expect(normalizeQuantityEntryTypeName(legacy).typeName).toBeNull();
  });

  it("trims blank typed names to null", () => {
    expect(normalizeQuantityEntryTypeName(baseEntry({ typeName: "  " })).typeName).toBeNull();
  });

  it("keeps typed names", () => {
    expect(
      normalizeQuantityEntryTypeName(baseEntry({ typeName: "Basic Wall:200mm" })).typeName,
    ).toBe("Basic Wall:200mm");
  });
});

describe("parseQuantityIndex typeName compatibility", () => {
  it("accepts legacy indexes without typeName and normalizes entries", () => {
    const raw = {
      version: 1 as const,
      fileVersionId: "fv",
      generatedAt: "2024-01-01T00:00:00.000Z",
      loq: {
        totalElements: 1,
        withIdentity: 1,
        withLevel: 1,
        withMaterial: 0,
        withQuantities: 0,
        withAuthoredColor: 0,
        pctQuantities: 0,
        pctMaterial: 0,
        pctLevel: 100,
        pctIdentity: 100,
        pctAuthoredColor: 0,
        recommendedExportHints: [],
      },
      elements: [
        {
          expressId: 10,
          guid: "g",
          ifcType: "IfcDoor",
          name: "D1",
          level: null,
          material: null,
          discipline: "Architecture",
          quantities: {},
          quantitySource: "missing",
          lodFlags: {
            identity: true,
            dimensions: false,
            quantities: false,
            material: false,
            color: false,
          },
        },
      ],
      byType: {
        IfcDoor: { ifcType: "IfcDoor", count: 1, guids: ["g"] },
      },
      byLevel: {
        Unassigned: { level: "Unassigned", count: 1, guids: ["g"] },
      },
    };

    const parsed = parseQuantityIndex(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.elements[0]!.typeName).toBeNull();
  });

  it("preserves typeName on new indexes", () => {
    const parsed = parseQuantityIndex({
      version: 1,
      fileVersionId: "fv",
      generatedAt: "2024-01-01T00:00:00.000Z",
      loq: {
        totalElements: 1,
        withIdentity: 1,
        withLevel: 0,
        withMaterial: 0,
        withQuantities: 0,
        withAuthoredColor: 0,
        pctQuantities: 0,
        pctMaterial: 0,
        pctLevel: 0,
        pctIdentity: 100,
        pctAuthoredColor: 0,
        recommendedExportHints: [],
      },
      elements: [baseEntry({ typeName: "Door:Single" })],
      byType: { IfcWall: { ifcType: "IfcWall", count: 1, guids: ["guid-a"] } },
      byLevel: { Unassigned: { level: "Unassigned", count: 1, guids: ["guid-a"] } },
    });
    expect(parsed!.elements[0]!.typeName).toBe("Door:Single");
  });
});

describe("hashElementMetadata typeName", () => {
  it("changes when typeName changes", () => {
    const a = baseEntry({ typeName: null });
    const b = baseEntry({ typeName: "Basic Wall:200mm" });
    expect(hashElementMetadata(a)).not.toBe(hashElementMetadata(b));
  });
});

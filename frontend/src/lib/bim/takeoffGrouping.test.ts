import { describe, expect, it } from "vitest";
import {
  groupEntriesForCost,
  costGroupKeyForEntry,
  recommendedCostGroupingHint,
} from "./takeoffGrouping";
import type { BimQuantityEntry } from "@/lib/bim/types";

function entry(overrides: Partial<BimQuantityEntry> = {}): BimQuantityEntry {
  return {
    expressId: 1,
    guid: "g1",
    ifcType: "IfcWall",
    name: "Wall-01",
    typeName: null,
    level: "L1",
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
    ...overrides,
  };
}

describe("costGroupKeyForEntry", () => {
  it("prefers type name when present", () => {
    const result = costGroupKeyForEntry(entry({ typeName: "Basic Wall:200mm" }));
    expect(result.source).toBe("typeName");
    expect(result.label).toBe("Basic Wall:200mm");
  });

  it("falls back to category + name", () => {
    const result = costGroupKeyForEntry(entry({ typeName: null, name: "W1" }));
    expect(result.source).toBe("categoryName");
    expect(result.label).toBe("Wall · W1");
  });

  it("treats blank typeName as missing", () => {
    const result = costGroupKeyForEntry(entry({ typeName: "  " }));
    expect(result.source).toBe("categoryName");
  });
});

describe("groupEntriesForCost", () => {
  it("merges elements that share a type name", () => {
    const groups = groupEntriesForCost([
      entry({ guid: "a", typeName: "Door:Single" }),
      entry({ guid: "b", typeName: "Door:Single", ifcType: "IfcDoor", name: "D2" }),
      entry({ guid: "c", typeName: null, name: "Orphan" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.count).toBe(2);
    expect(groups[0]!.source).toBe("typeName");
    expect(groups[1]!.source).toBe("categoryName");
  });
});

describe("recommendedCostGroupingHint", () => {
  it("describes typed, untyped, and mixed selections", () => {
    expect(
      recommendedCostGroupingHint([
        { key: "t", label: "T", source: "typeName", guids: ["a"], count: 1 },
      ]),
    ).toContain("Type name");
    expect(
      recommendedCostGroupingHint([
        { key: "f", label: "F", source: "categoryName", guids: ["a"], count: 1 },
      ]),
    ).toContain("Category + Name");
    expect(
      recommendedCostGroupingHint([
        { key: "t", label: "T", source: "typeName", guids: ["a"], count: 1 },
        { key: "f", label: "F", source: "categoryName", guids: ["b"], count: 1 },
      ]),
    ).toContain("1 of 2");
  });
});

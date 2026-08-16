import { describe, expect, it } from "vitest";
import { costGroupForEntry, groupEntriesForCostTakeoff } from "./takeoffGrouping.js";
import type { BimQuantityEntry } from "./types.js";

function entry(overrides: Partial<BimQuantityEntry> = {}): BimQuantityEntry {
  return {
    expressId: 1,
    guid: "g1",
    ifcType: "IfcWall",
    name: "Wall-01",
    typeName: null,
    level: null,
    material: null,
    discipline: "Architecture",
    quantities: { area: 1 },
    quantitySource: "computed",
    lodFlags: {
      identity: true,
      dimensions: true,
      quantities: true,
      material: false,
      color: false,
    },
    ...overrides,
  };
}

describe("backend takeoffGrouping", () => {
  it("keys typed elements by type name", () => {
    const g = costGroupForEntry(entry({ typeName: "Basic Wall:200mm" }));
    expect(g.key).toBe("typename:Basic Wall:200mm");
    expect(g.source).toBe("typeName");
  });

  it("falls back to IFC category for untyped / legacy entries", () => {
    const legacy = entry();
    delete (legacy as { typeName?: string | null }).typeName;
    const g = costGroupForEntry(legacy);
    expect(g.key).toBe("type:IfcWall");
    expect(g.source).toBe("ifcType");
  });

  it("splits auto-map groups by type name within a category", () => {
    const groups = groupEntriesForCostTakeoff([
      entry({ guid: "a", typeName: "Basic Wall:200mm" }),
      entry({ guid: "b", typeName: "Basic Wall:200mm" }),
      entry({ guid: "c", typeName: "Basic Wall:300mm" }),
      entry({ guid: "d", typeName: null }),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.label === "Basic Wall:200mm")?.guids).toEqual(["a", "b"]);
    expect(groups.find((g) => g.source === "ifcType")?.guids).toEqual(["d"]);
  });
});

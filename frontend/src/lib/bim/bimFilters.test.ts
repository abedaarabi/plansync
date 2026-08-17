import { describe, expect, it } from "vitest";
import {
  listFilterFieldValues,
  matchFilteredElements,
  parseFilterState,
  ruleFromPropertyRow,
  type BimFilterState,
} from "./bimFilters";
import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";

function entry(overrides: Partial<BimQuantityEntry> = {}): BimQuantityEntry {
  return {
    expressId: 1,
    guid: "guid-1",
    ifcType: "IfcWall",
    name: "Wall A",
    typeName: "Basic Wall:200mm",
    level: "Level 1",
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

function index(elements: BimQuantityEntry[]): BimQuantityIndex {
  const byType: BimQuantityIndex["byType"] = {};
  const byLevel: BimQuantityIndex["byLevel"] = {};
  for (const el of elements) {
    if (!byType[el.ifcType]) byType[el.ifcType] = { ifcType: el.ifcType, count: 0, guids: [] };
    byType[el.ifcType]!.count += 1;
    byType[el.ifcType]!.guids.push(el.guid);
    const level = el.level ?? "Unassigned";
    if (!byLevel[level]) byLevel[level] = { level, count: 0, guids: [] };
    byLevel[level]!.count += 1;
    byLevel[level]!.guids.push(el.guid);
  }
  return {
    version: 1,
    fileVersionId: "fv",
    generatedAt: new Date().toISOString(),
    loq: {
      totalElements: elements.length,
      withIdentity: elements.length,
      withLevel: elements.length,
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
    elements,
    byType,
    byLevel,
  };
}

describe("bimFilters typeName", () => {
  it("lists distinct type names", () => {
    const idx = index([
      entry({ guid: "a", typeName: "Basic Wall:200mm" }),
      entry({ guid: "b", typeName: "Basic Wall:200mm" }),
      entry({ guid: "c", typeName: "Door:Single" }),
      entry({ guid: "d", typeName: null }),
    ]);
    const values = listFilterFieldValues(idx, "typeName");
    expect(values.map((v) => v.value)).toEqual(["Basic Wall:200mm", "Door:Single"]);
    expect(values[0]!.count).toBe(2);
  });

  it("filters by type name and searches any field", () => {
    const idx = index([
      entry({ guid: "a", typeName: "Basic Wall:200mm" }),
      entry({ guid: "b", typeName: "Door:Single", ifcType: "IfcDoor", name: "D1" }),
    ]);
    const state: BimFilterState = {
      rules: [
        {
          id: "1",
          field: "typeName",
          op: "eq",
          value: "Basic Wall:200mm",
        },
      ],
      textQuery: "",
      visualize: "ghost",
      colorize: null,
    };
    expect(matchFilteredElements(idx, state).map((e) => e.guid)).toEqual(["a"]);

    const anyState: BimFilterState = {
      ...state,
      rules: [{ id: "2", field: "any", op: "contains", value: "Door:Single" }],
    };
    expect(matchFilteredElements(idx, anyState).map((e) => e.guid)).toEqual(["b"]);
  });

  it("parses typeName rules and maps Type name property rows", () => {
    const parsed = parseFilterState({
      rules: [{ id: "r", field: "typeName", op: "eq", value: "T1" }],
      textQuery: "",
      visualize: "ghost",
      colorize: { enabled: true, field: "typeName" },
    });
    expect(parsed?.rules[0]?.field).toBe("typeName");
    expect(parsed?.colorize?.field).toBe("typeName");

    const rule = ruleFromPropertyRow("General", "Type name", "Basic Wall:200mm");
    expect(rule?.field).toBe("typeName");
  });

  it("ignores openings that inherit the host element name", () => {
    const idx = index([
      entry({ guid: "wall", name: "Basic Wall:240mm:426134" }),
      entry({
        guid: "void-1",
        ifcType: "IfcOpeningElement",
        name: "Basic Wall:240mm:426134",
      }),
      entry({
        guid: "void-2",
        ifcType: "IfcOpeningElement",
        name: "Basic Wall:240mm:426134",
      }),
    ]);
    const values = listFilterFieldValues(idx, "name");
    expect(values).toEqual([
      { value: "Basic Wall:240mm:426134", label: "Basic Wall:240mm:426134", count: 1 },
    ]);

    const state: BimFilterState = {
      rules: [{ id: "1", field: "name", op: "eq", value: "Basic Wall:240mm:426134" }],
      textQuery: "",
      visualize: "ghost",
      colorize: null,
    };
    expect(matchFilteredElements(idx, state).map((e) => e.guid)).toEqual(["wall"]);
  });

  it("keeps legacy indexes without typeName filterable as empty", () => {
    const legacy = entry({ guid: "legacy" });
    delete (legacy as { typeName?: string | null }).typeName;
    const idx = index([legacy]);
    expect(listFilterFieldValues(idx, "typeName")).toEqual([]);
  });
});

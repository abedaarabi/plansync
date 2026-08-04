import { describe, expect, it } from "vitest";
import type { BimQuantityIndex } from "@plansync/shared/bimTypes";
import {
  buildClashSetDef,
  disciplineSetDef,
  displayModelLabel,
  ifcTypeCountsForModel,
  resolveClashSet,
  sortModelsForClashPair,
} from "./clashSets";

function sampleIndex(): BimQuantityIndex {
  return {
    version: 1,
    fileVersionId: "fv-root",
    generatedAt: new Date().toISOString(),
    loq: {
      totalElements: 3,
      withIdentity: 3,
      withLevel: 3,
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
        expressId: 1,
        guid: "g-beam",
        ifcType: "IfcBeam",
        name: "Beam 1",
        level: "L01",
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
        sourceFileVersionId: "fv-a",
        sourceModelId: "fileA:fv-a",
      },
      {
        expressId: 2,
        guid: "g-duct",
        ifcType: "IfcDuctSegment",
        name: "Duct 1",
        level: "L01",
        material: null,
        discipline: "Mechanical",
        quantities: {},
        quantitySource: "missing",
        lodFlags: {
          identity: true,
          dimensions: false,
          quantities: false,
          material: false,
          color: false,
        },
        sourceFileVersionId: "fv-b",
        sourceModelId: "fileB:fv-b",
      },
      {
        expressId: 3,
        guid: "g-wall",
        ifcType: "IfcWall",
        name: "Wall 1",
        level: "L02",
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
    byType: {},
    byLevel: {},
  };
}

describe("clashSets", () => {
  it("resolves discipline sets", () => {
    const index = sampleIndex();
    const structural = resolveClashSet(index, disciplineSetDef("Structure"));
    expect(structural.map((e) => e.guid)).toEqual(["g-beam"]);
    const mechanical = resolveClashSet(index, disciplineSetDef("Mechanical"));
    expect(mechanical.map((e) => e.guid)).toEqual(["g-duct"]);
  });

  it("treats MEP as umbrella over Mechanical and Electrical", () => {
    const index = sampleIndex();
    const mep = resolveClashSet(index, disciplineSetDef("MEP"));
    expect(mep.map((e) => e.guid)).toEqual(["g-duct"]);
  });

  it("ANDs level with discipline", () => {
    const index = sampleIndex();
    const set = {
      label: "Structure L02",
      rules: [
        { field: "discipline" as const, values: ["Architecture"] },
        { field: "level" as const, values: ["L02"] },
      ],
    };
    const resolved = resolveClashSet(index, set, "fv-root");
    expect(resolved.map((e) => e.guid)).toEqual(["g-wall"]);
    expect(resolved[0]!.fileVersionId).toBe("fv-root");
  });

  it("resolves model rules", () => {
    const index = sampleIndex();
    const set = {
      label: "Model A",
      rules: [{ field: "model" as const, values: ["fileA:fv-a"] }],
    };
    const resolved = resolveClashSet(index, set);
    expect(resolved.map((e) => e.guid)).toEqual(["g-beam"]);
  });

  it("matches progressive tile model ids to bare member ids", () => {
    const index = sampleIndex();
    const set = {
      label: "Model A tile",
      rules: [{ field: "model" as const, values: ["fileA:fv-a__L01"] }],
    };
    expect(resolveClashSet(index, set).map((e) => e.guid)).toEqual(["g-beam"]);
    expect(ifcTypeCountsForModel(index, "fileB:fv-b__0_0_0")).toEqual([
      { ifcType: "IfcDuctSegment", count: 1 },
    ]);
  });

  it("labels and sorts models from file names", () => {
    expect(displayModelLabel("MEP_Services.ifc")).toBe("MEP_Services");
    const sorted = sortModelsForClashPair([
      { name: "MEP.ifc", modelId: "m" },
      { name: "Structure.ifc", modelId: "s" },
    ]);
    expect(sorted.map((m) => m.name)).toEqual(["Structure.ifc", "MEP.ifc"]);
  });

  it("builds typed model sets and lists types per model", () => {
    const set = buildClashSetDef({
      modelId: "fileA:fv-a",
      modelName: "Structure.ifc",
      ifcTypes: ["IfcBeam", "IfcColumn"],
    });
    expect(set.label).toContain("Structure");
    expect(set.rules.some((r) => r.field === "ifcType")).toBe(true);
    const typed = resolveClashSet(sampleIndex(), set);
    expect(typed.map((e) => e.guid)).toEqual(["g-beam"]);

    const counts = ifcTypeCountsForModel(sampleIndex(), "fileB:fv-b");
    expect(counts).toEqual([{ ifcType: "IfcDuctSegment", count: 1 }]);
  });
});

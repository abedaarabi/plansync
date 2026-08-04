import { describe, expect, it } from "vitest";
import { baseFederationModelId, buildModelId, collapseLoadedModelsByMember } from "./federation";

describe("federation model ids", () => {
  it("strips progressive tile suffixes", () => {
    expect(baseFederationModelId("fileA:fv-a")).toBe("fileA:fv-a");
    expect(baseFederationModelId("fileA:fv-a__L01")).toBe("fileA:fv-a");
    expect(baseFederationModelId("fileA:fv-a__0_0_0")).toBe("fileA:fv-a");
  });

  it("collapses tiles into one logical model per IFC", () => {
    const member = {
      fileId: "fileA",
      fileVersionId: "fv-a",
      name: "Structure.ifc",
      version: "3",
    };
    const collapsed = collapseLoadedModelsByMember([
      { ...member, modelId: "fileA:fv-a__L01", visible: true },
      { ...member, modelId: "fileA:fv-a__L02", visible: true },
      {
        fileId: "fileB",
        fileVersionId: "fv-b",
        name: "MEP.ifc",
        version: "1",
        modelId: "fileB:fv-b__0_0_0",
        visible: false,
      },
    ]);
    expect(collapsed).toEqual([
      {
        ...member,
        modelId: buildModelId(member),
        visible: true,
      },
      {
        fileId: "fileB",
        fileVersionId: "fv-b",
        name: "MEP.ifc",
        version: "1",
        modelId: "fileB:fv-b",
        visible: false,
      },
    ]);
  });
});

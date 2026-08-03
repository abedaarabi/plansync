import { describe, expect, it } from "vitest";
import { buildWorkspaceHref, parseBuildingWorkspaceMode } from "./workspaceHref";

describe("parseBuildingWorkspaceMode", () => {
  it("returns explicit mode", () => {
    expect(parseBuildingWorkspaceMode("work")).toBe("work");
    expect(parseBuildingWorkspaceMode("edit")).toBe("edit");
  });

  it("defaults to work when mode is missing", () => {
    expect(parseBuildingWorkspaceMode(null)).toBe("work");
    expect(parseBuildingWorkspaceMode(undefined)).toBe("work");
    expect(parseBuildingWorkspaceMode("other")).toBe("work");
  });

  it("infers edit when align is active without mode", () => {
    expect(parseBuildingWorkspaceMode(null, { alignActive: true })).toBe("edit");
  });
});

describe("buildWorkspaceHref", () => {
  it("includes mode when set", () => {
    const href = buildWorkspaceHref({
      fileId: "f1",
      fileName: "Model.ifc",
      projectId: "p1",
      buildingId: "b1",
      locationId: "l1",
      mode: "edit",
      view: "3d",
    });
    expect(href).toContain("mode=edit");
    expect(href).toContain("view=3d");
  });

  it("includes federation models and panel", () => {
    const href = buildWorkspaceHref({
      fileId: "f1",
      fileName: "A.ifc",
      projectId: "p1",
      buildingId: "b1",
      locationId: "l1",
      fileVersionId: "v1",
      mode: "work",
      panel: "clashes",
      models: [{ fileId: "f2", fileVersionId: "v2", name: "B.ifc", version: "1" }],
    });
    expect(href).toContain("panel=clashes");
    expect(href).toContain("models=");
    expect(href).toContain("buildingId=b1");
  });
});

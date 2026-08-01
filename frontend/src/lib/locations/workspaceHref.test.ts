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
});

import { describe, expect, it } from "vitest";
import {
  takeoffLineHasViewerLink,
  takeoffLineIfcGuids,
  viewerHrefForTakeoffLine,
  type TakeoffLineRow,
} from "./core-issues-takeoff";

function baseRow(over: Partial<TakeoffLineRow> = {}): TakeoffLineRow {
  return {
    id: "line-1",
    workspaceId: "ws-1",
    projectId: "proj-1",
    fileId: "file-1",
    fileVersionId: "fv-1",
    fileVersion: 2,
    fileName: "Model.ifc",
    materialId: null,
    label: "Walls",
    quantity: "10",
    unit: "m²",
    notes: null,
    sourceZoneId: null,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    material: null,
    ...over,
  };
}

describe("takeoffLineIfcGuids", () => {
  it("prefers sourceIfcGuids over sourceIfcGuid", () => {
    expect(
      takeoffLineIfcGuids(baseRow({ sourceIfcGuid: "g-solo", sourceIfcGuids: ["g-a", "g-b"] })),
    ).toEqual(["g-a", "g-b"]);
  });

  it("falls back to sourceIfcGuid", () => {
    expect(takeoffLineIfcGuids(baseRow({ sourceIfcGuid: "g-solo" }))).toEqual(["g-solo"]);
  });
});

describe("viewerHrefForTakeoffLine", () => {
  it("opens PDF viewer with takeoffZoneId for sheet lines", () => {
    const href = viewerHrefForTakeoffLine(baseRow({ sourceZoneId: "zone-1", fileName: "A.pdf" }));
    expect(href).toContain("/viewer?");
    expect(href).toContain("takeoffZoneId=zone-1");
    expect(href).not.toContain("/bim-viewer");
  });

  it("opens BIM viewer with guid for a single-element line", () => {
    const href = viewerHrefForTakeoffLine(
      baseRow({ sourceType: "bim", sourceIfcGuid: "guid-1", sourceIfcGuids: ["guid-1"] }),
    );
    expect(href).toContain("/bim-viewer?");
    expect(href).toContain("guid=guid-1");
    expect(href).not.toContain("guids=");
  });

  it("opens BIM viewer with guids for aggregate lines", () => {
    const href = viewerHrefForTakeoffLine(
      baseRow({ sourceType: "bim", sourceIfcGuids: ["g1", "g2", "g3"] }),
    );
    expect(href).toContain("/bim-viewer?");
    expect(href).toContain("guids=g1%2Cg2%2Cg3");
  });
});

describe("takeoffLineHasViewerLink", () => {
  it("is true for zone and bim-linked lines", () => {
    expect(takeoffLineHasViewerLink(baseRow({ sourceZoneId: "z1" }))).toBe(true);
    expect(takeoffLineHasViewerLink(baseRow({ sourceType: "bim", sourceIfcGuid: "g1" }))).toBe(
      true,
    );
    expect(takeoffLineHasViewerLink(baseRow({ sourceType: "manual" }))).toBe(false);
  });
});

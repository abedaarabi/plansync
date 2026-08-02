import { describe, expect, it } from "vitest";
import type { BimQuantityIndex } from "@plansync/shared/bimTypes";
import type { BimClashRow } from "@/lib/api-client/bim-clash";
import { clashElementLabel, enrichClashRowsWithQuantityNames } from "./clashLabels";

function row(partial: Partial<BimClashRow> & Pick<BimClashRow, "guidA" | "guidB">): BimClashRow {
  return {
    id: "c1",
    testId: "t1",
    projectId: "p1",
    fileVersionAId: "fvA",
    fileVersionBId: "fvB",
    elementAId: "eA",
    elementBId: "eB",
    clashType: "HARD",
    distanceMm: 0,
    point: { x: 0, y: 0, z: 0 },
    contactCount: 1,
    status: "NEW",
    statusChangedAt: null,
    statusDistanceMm: null,
    assigneeId: null,
    groupId: null,
    elementMissingSinceId: null,
    issueId: null,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elementA: null,
    elementB: null,
    assignee: null,
    issue: null,
    ...partial,
  };
}

describe("clashLabels", () => {
  it("prefers name, then type, then short guid", () => {
    expect(clashElementLabel({ name: "Beam-1", ifcType: "IfcBeam" }, "abcdefgh")).toBe("Beam-1");
    expect(clashElementLabel({ name: null, ifcType: "IfcBeam" }, "abcdefgh")).toBe("Beam");
    expect(clashElementLabel(null, "abcdefghijkl")).toBe("abcdefgh");
  });

  it("enriches stub clash rows from the quantity index", () => {
    const index = {
      fileVersionId: "fvA",
      elements: [
        {
          expressId: 1,
          guid: "guid-a",
          ifcType: "IfcWall",
          name: "Wall Exterior",
          level: null,
          material: null,
          discipline: "architecture",
          quantities: {},
          quantitySource: "base",
          lodFlags: {},
          sourceFileVersionId: "fvA",
        },
        {
          expressId: 2,
          guid: "guid-b",
          ifcType: "IfcDuctSegment",
          name: "Supply Duct 12",
          level: null,
          material: null,
          discipline: "mechanical",
          quantities: {},
          quantitySource: "base",
          lodFlags: {},
          sourceFileVersionId: "fvB",
        },
      ],
    } as unknown as BimQuantityIndex;

    const enriched = enrichClashRowsWithQuantityNames(
      [row({ guidA: "guid-a", guidB: "guid-b" })],
      index,
    );
    expect(enriched[0]!.elementA?.name).toBe("Wall Exterior");
    expect(enriched[0]!.elementB?.name).toBe("Supply Duct 12");
    expect(clashElementLabel(enriched[0]!.elementA, "guid-a")).toBe("Wall Exterior");
    expect(clashElementLabel(enriched[0]!.elementB, "guid-b")).toBe("Supply Duct 12");
  });
});

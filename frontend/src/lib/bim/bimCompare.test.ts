import { describe, expect, it } from "vitest";
import {
  compareChangedCount,
  filterCompareRows,
  isCompareStyleId,
  pickDefaultBaseVersion,
  type BimElementChanges,
  type BimCompareRow,
} from "./bimCompare";

function row(overrides: Partial<BimCompareRow>): BimCompareRow {
  return {
    guid: "g",
    name: "Wall",
    ifcType: "IfcWall",
    kind: "added",
    ...overrides,
  };
}

const sample: BimElementChanges = {
  baseFileVersionId: "base",
  compareFileVersionId: "cur",
  baseVersion: 1,
  compareVersion: 2,
  added: [row({ guid: "a", name: "New door", ifcType: "IfcDoor", kind: "added" })],
  modified: [row({ guid: "m", name: "Wall A", ifcType: "IfcWall", kind: "modified" })],
  deleted: [row({ guid: "d", name: "Old col", ifcType: "IfcColumn", kind: "deleted" })],
  counts: {
    added: 1,
    modified: 1,
    deleted: 1,
    unchanged: 10,
    baseLive: 12,
    currentLive: 12,
  },
};

describe("bimCompare helpers", () => {
  it("picks the previous published ready version by default", () => {
    const id = pickDefaultBaseVersion(
      [
        { id: "v4", version: 4, bimReady: true, bimPublishedAt: null },
        { id: "v3", version: 3, bimReady: true, bimPublishedAt: "2026-01-01" },
        { id: "v2", version: 2, bimReady: true, bimPublishedAt: null },
        { id: "v1", version: 1, bimReady: false, bimPublishedAt: "2025-01-01" },
      ],
      "v4",
    );
    expect(id).toBe("v3");
  });

  it("honors a preferred base when it belongs to the file", () => {
    expect(
      pickDefaultBaseVersion(
        [
          { id: "v2", version: 2, bimReady: true },
          { id: "v1", version: 1, bimReady: true },
        ],
        "v2",
        "v1",
      ),
    ).toBe("v1");
  });

  it("filters the change list by kind, type, and query", () => {
    const walls = filterCompareRows(sample, {
      query: "wall",
      ifcType: null,
      visibleKinds: { added: true, modified: true, deleted: false },
    });
    expect(walls.map((r) => r.guid)).toEqual(["m"]);
    const doors = filterCompareRows(sample, {
      query: "",
      ifcType: "IfcDoor",
      visibleKinds: { added: true, modified: true, deleted: true },
    });
    expect(doors.map((r) => r.guid)).toEqual(["a"]);
  });

  it("counts only added/modified/deleted", () => {
    expect(compareChangedCount(sample.counts)).toBe(3);
    expect(isCompareStyleId("compare:added")).toBe(true);
    expect(isCompareStyleId("colorize:0")).toBe(false);
  });
});

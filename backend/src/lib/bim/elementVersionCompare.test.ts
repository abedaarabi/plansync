import { describe, expect, it } from "vitest";
import {
  diffElementMetadata,
  diffElementVersions,
  type ElementVersionSnapshot,
} from "./elementVersionCompare.js";

function snap(overrides: Partial<ElementVersionSnapshot>): ElementVersionSnapshot {
  return {
    ifcGuid: "g1",
    name: "Wall",
    ifcType: "IfcWall",
    metadataHash: "hash-a",
    live: true,
    ...overrides,
  };
}

describe("diffElementVersions", () => {
  it("classifies added, modified, deleted, and unchanged against an arbitrary base", () => {
    const base = [
      snap({ ifcGuid: "keep", metadataHash: "h1" }),
      snap({ ifcGuid: "changed", name: "Door", ifcType: "IfcDoor", metadataHash: "old" }),
      snap({ ifcGuid: "gone", name: "Col", ifcType: "IfcColumn", metadataHash: "c" }),
      snap({ ifcGuid: "tombstone", live: false, metadataHash: "x" }),
    ];
    const current = [
      snap({ ifcGuid: "keep", metadataHash: "h1" }),
      snap({ ifcGuid: "changed", name: "Door v2", ifcType: "IfcDoor", metadataHash: "new" }),
      snap({ ifcGuid: "fresh", name: "Win", ifcType: "IfcWindow", metadataHash: "w" }),
      snap({ ifcGuid: "gone", live: false, metadataHash: "c" }),
    ];
    const diff = diffElementVersions(current, base);
    expect(diff.added.map((r) => r.guid)).toEqual(["fresh"]);
    expect(diff.modified.map((r) => r.guid)).toEqual(["changed"]);
    expect(diff.deleted.map((r) => r.guid)).toEqual(["gone"]);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.baseLiveCount).toBe(3);
    expect(diff.currentLiveCount).toBe(3);
  });

  it("does not use sequential changeType — only live + hash vs the requested base", () => {
    const v1 = [snap({ ifcGuid: "a", metadataHash: "1" })];
    const v3 = [
      snap({ ifcGuid: "a", metadataHash: "1" }),
      snap({ ifcGuid: "b", metadataHash: "2" }),
    ];
    const diff = diffElementVersions(v3, v1);
    expect(diff.added.map((r) => r.guid)).toEqual(["b"]);
    expect(diff.modified).toEqual([]);
    expect(diff.deleted).toEqual([]);
  });
});

describe("diffElementMetadata", () => {
  it("returns only changed scalar and quantity fields", () => {
    const fields = diffElementMetadata(
      {
        name: "Wall A",
        ifcType: "IfcWall",
        level: "L1",
        quantities: { area: 12, volume: 1 },
      },
      {
        name: "Wall A",
        ifcType: "IfcWall",
        level: "L2",
        quantities: { area: 14, volume: 1 },
      },
    );
    expect(fields).toEqual([
      { key: "level", label: "Level", before: "L1", after: "L2" },
      { key: "quantities.area", label: "Area", before: "12", after: "14" },
    ]);
  });

  it("treats missing payloads as empty", () => {
    const fields = diffElementMetadata(null, { name: "New" });
    expect(fields).toContainEqual({
      key: "name",
      label: "Name",
      before: null,
      after: "New",
    });
  });
});

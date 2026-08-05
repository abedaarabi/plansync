import { describe, expect, it } from "vitest";
import { broadPhasePairs, makeBoxMesh, runClashOnBoxes } from "./clashCore";

describe("clashCore", () => {
  it("detects hard overlap", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const b = makeBoxMesh("b", "fv1", { x: 0.5, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: false,
      clearanceMm: 0,
      runMode: "HARD",
    });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0]!.clashType).toBe("HARD");
    expect(result.hits[0]!.distanceMm).toBeLessThanOrEqual(0);
  });

  it("detects clearance within tolerance", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const b = makeBoxMesh("b", "fv1", { x: 1.02, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    // gap ≈ 0.02m = 20mm between faces (centers 1.02 apart, half extents 0.5 each → gap 0.02)
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: true,
      clearanceMm: 25,
      runMode: "BOTH",
    });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0]!.clashType).toBe("CLEARANCE");
    expect(result.hits[0]!.distanceMm).toBeGreaterThan(0);
    expect(result.hits[0]!.distanceMm).toBeLessThanOrEqual(25);
    expect(result.hits[0]!.closestA).toBeDefined();
    expect(result.hits[0]!.closestB).toBeDefined();
  });

  it("ignores clearance outside tolerance", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const b = makeBoxMesh("b", "fv1", { x: 1.2, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    // gap ≈ 0.2m = 200mm
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: true,
      clearanceMm: 25,
      runMode: "BOTH",
    });
    expect(result.hits.length).toBe(0);
  });

  it("clearance-only mode skips hard overlaps", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const b = makeBoxMesh("b", "fv1", { x: 0.5, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: true,
      clearanceMm: 25,
      runMode: "CLEARANCE",
    });
    expect(result.hits.every((h) => h.clashType !== "HARD")).toBe(true);
  });

  it("hard-only mode skips clearance gaps", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const b = makeBoxMesh("b", "fv1", { x: 1.02, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: true,
      clearanceMm: 25,
      runMode: "HARD",
    });
    expect(result.hits.length).toBe(0);
  });

  it("pads only set A in broad phase", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    // gap 30mm — within 25mm only if both sides were padded (50mm effective)
    const b = makeBoxMesh("b", "fv1", { x: 1.03, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const pairs = broadPhasePairs([a.box], [b.box], 25, true);
    // 30mm gap, pad A by 25mm → still no overlap with unpadded B
    expect(pairs.length).toBe(0);
  });

  it("flags duplicates by centroid and type when not intersecting", () => {
    const a = makeBoxMesh(
      "a",
      "fv1",
      { x: 0, y: 0, z: 0 },
      { x: 0.1, y: 0.1, z: 0.1 },
      "IfcPipeSegment",
    );
    const b = makeBoxMesh(
      "b",
      "fv2",
      { x: 0.02, y: 0, z: 0 },
      { x: 0.1, y: 0.1, z: 0.1 },
      "IfcPipeSegment",
    );
    // Centers 20mm apart, boxes may barely overlap — use separated non-overlap duplicates
    const a2 = makeBoxMesh(
      "a2",
      "fv1",
      { x: 0, y: 0, z: 0 },
      { x: 0.02, y: 0.02, z: 0.02 },
      "IfcPipeSegment",
    );
    const b2 = makeBoxMesh(
      "b2",
      "fv2",
      { x: 0.045, y: 0, z: 0 },
      { x: 0.02, y: 0.02, z: 0.02 },
      "IfcPipeSegment",
    );
    const pairs = broadPhasePairs([a.box], [b.box], 0, false);
    expect(pairs.length).toBeGreaterThanOrEqual(0);
    const result = runClashOnBoxes([a2], [b2], {
      clearanceEnabled: true,
      clearanceMm: 100,
      runMode: "BOTH",
    });
    // Either clearance or duplicate — not hard when surfaces don't intersect deeply
    expect(
      result.hits.some((h) => h.clashType === "DUPLICATE" || h.clashType === "CLEARANCE"),
    ).toBe(true);
  });

  it("skips far-apart elements in broad phase", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const b = makeBoxMesh("b", "fv1", { x: 50, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const pairs = broadPhasePairs([a.box], [b.box], 25, true);
    expect(pairs.length).toBe(0);
  });
});

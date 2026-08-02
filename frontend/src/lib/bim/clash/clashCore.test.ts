import { describe, expect, it } from "vitest";
import { broadPhasePairs, makeBoxMesh, runClashOnBoxes } from "./clashCore";

describe("clashCore", () => {
  it("detects hard overlap", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const b = makeBoxMesh("b", "fv1", { x: 0.5, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: false,
      clearanceMm: 0,
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
    });
    expect(result.hits.length).toBe(1);
    expect(result.hits[0]!.clashType).toBe("CLEARANCE");
    expect(result.hits[0]!.distanceMm).toBeGreaterThan(0);
    expect(result.hits[0]!.distanceMm).toBeLessThanOrEqual(25);
  });

  it("ignores clearance outside tolerance", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const b = makeBoxMesh("b", "fv1", { x: 1.2, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    // gap ≈ 0.2m = 200mm
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: true,
      clearanceMm: 25,
    });
    expect(result.hits.length).toBe(0);
  });

  it("flags duplicates by centroid and type", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, "IfcPipeSegment");
    const b = makeBoxMesh(
      "b",
      "fv2",
      { x: 0.01, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      "IfcPipeSegment",
    );
    const pairs = broadPhasePairs([a.box], [b.box], 0, false);
    expect(pairs.some((p) => p.duplicate)).toBe(true);
    const result = runClashOnBoxes([a], [b], {
      clearanceEnabled: false,
      clearanceMm: 0,
    });
    expect(result.hits.some((h) => h.clashType === "DUPLICATE")).toBe(true);
  });

  it("skips far-apart elements in broad phase", () => {
    const a = makeBoxMesh("a", "fv1", { x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const b = makeBoxMesh("b", "fv1", { x: 50, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 });
    const pairs = broadPhasePairs([a.box], [b.box], 25, true);
    expect(pairs.length).toBe(0);
  });
});

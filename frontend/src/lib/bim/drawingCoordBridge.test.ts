import { describe, expect, it } from "vitest";
import {
  buildTransformFromControlPoints,
  fitSimilarityTransform,
  pdfNormToWorldXZ,
  pdfUserToNorm,
  worldXZToPdfNorm,
  type DrawingCoordTransform,
} from "./drawingCoordBridge";

describe("fitSimilarityTransform", () => {
  it("recovers identity transform for aligned points", () => {
    const pairs = [
      { src: { x: 0, z: 0 }, dst: { x: 0, z: 0 } },
      { src: { x: 100, z: 0 }, dst: { x: 100, z: 0 } },
      { src: { x: 0, z: 50 }, dst: { x: 0, z: 50 } },
    ];
    const t = fitSimilarityTransform(pairs);
    expect(t.scale).toBeCloseTo(1, 5);
    expect(t.rotationRad).toBeCloseTo(0, 5);
    expect(t.translation.x).toBeCloseTo(0, 5);
    expect(t.translation.z).toBeCloseTo(0, 5);
  });

  it("fits uniform scale and translation", () => {
    const pairs = [
      { src: { x: 0, z: 0 }, dst: { x: 10, z: 20 } },
      { src: { x: 10, z: 0 }, dst: { x: 20, z: 20 } },
    ];
    const t = fitSimilarityTransform(pairs);
    expect(t.scale).toBeCloseTo(1, 5);
    expect(t.translation.x).toBeCloseTo(10, 5);
    expect(t.translation.z).toBeCloseTo(20, 5);
  });
});

describe("drawingCoordBridge round-trip", () => {
  const pageWidthPt = 612;
  const pageHeightPt = 792;

  it("pdfUserToNorm maps page corners", () => {
    expect(pdfUserToNorm(0, 0, pageWidthPt, pageHeightPt)).toEqual({ x: 0, y: 0 });
    expect(pdfUserToNorm(pageWidthPt, pageHeightPt, pageWidthPt, pageHeightPt)).toEqual({
      x: 1,
      y: 1,
    });
  });

  it("pdfNormToWorldXZ and worldXZToPdfNorm are inverses", () => {
    const transform = {
      version: 1 as const,
      controlPoints: [] as DrawingCoordTransform["controlPoints"],
      scale: 0.05,
      rotationRad: 0.12,
      translation: { x: 10, z: -5 },
      mmPerPdfUnit: 0.3528,
      pageWidthPt,
      pageHeightPt,
    };

    const norms = [
      { x: 0.1, y: 0.2 },
      { x: 0.8, y: 0.7 },
      { x: 0.4, y: 0.9 },
    ];

    transform.controlPoints = norms.map((pdfNorm) => ({
      pdfNorm,
      worldXZ: pdfNormToWorldXZ(pdfNorm, transform),
    }));

    for (const cp of transform.controlPoints) {
      const back = worldXZToPdfNorm(cp.worldXZ.x, cp.worldXZ.z, transform);
      expect(back.x).toBeCloseTo(cp.pdfNorm.x, 5);
      expect(back.y).toBeCloseTo(cp.pdfNorm.y, 5);
    }
  });
});

describe("buildTransformFromControlPoints", () => {
  it("fits a similarity transform through two control points", () => {
    const controlPoints = [
      { pdfNorm: { x: 0, y: 0 }, worldXZ: { x: 0, z: 0 } },
      { pdfNorm: { x: 1, y: 0 }, worldXZ: { x: 612, z: 0 } },
    ];
    const transform = buildTransformFromControlPoints(controlPoints, 0.3528, 612, 792);
    const world = pdfNormToWorldXZ({ x: 1, y: 0 }, transform);
    expect(world.x).toBeCloseTo(612, 1);
    expect(world.z).toBeCloseTo(0, 1);
  });
});

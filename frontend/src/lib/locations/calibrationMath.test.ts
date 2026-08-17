import { fitSimilarityTransform } from "@/lib/bim/drawingCoordBridge";
import { describe, expect, it } from "vitest";
import {
  applyTransformToPoint,
  bakeTransformIntoCalibration,
  computeTransformFromCalibration,
  invertCutDisplayPick,
  overlayTransformCss,
  rotateNormAroundCenter,
  snapCutDisplayRotation,
  snapRotationDeg,
} from "./calibrationMath";
import type { CalibrationInput } from "@/lib/api-client/locations";

describe("computeTransformFromCalibration", () => {
  it("derives identity-like transform for aligned points", () => {
    const calibration = {
      pointPairs: [
        { pdf: { x: 0, y: 0 }, plan: { x: 0, y: 0 } },
        { pdf: { x: 10, y: 0 }, plan: { x: 10, y: 0 } },
      ],
    } satisfies CalibrationInput;
    const t = computeTransformFromCalibration(calibration);
    expect(t.scale).toBeCloseTo(1, 3);
    expect(t.rotationDeg).toBeCloseTo(0, 3);
    expect(t.offsetX).toBeCloseTo(0, 3);
    expect(t.offsetY).toBeCloseTo(0, 3);
  });

  it("matches fitSimilarityTransform for scaled points", () => {
    const pairs = [
      { src: { x: 0, z: 0 }, dst: { x: 0, z: 0 } },
      { src: { x: 5, z: 0 }, dst: { x: 10, z: 0 } },
    ];
    const direct = fitSimilarityTransform(pairs);
    const via = computeTransformFromCalibration({
      pointPairs: [
        { pdf: { x: 0, y: 0 }, plan: { x: 0, y: 0 } },
        { pdf: { x: 5, y: 0 }, plan: { x: 10, y: 0 } },
      ],
    });
    expect(via.scale).toBeCloseTo(direct.scale, 5);
    expect(via.rotationDeg).toBeCloseTo((direct.rotationRad * 180) / Math.PI, 5);
  });
});

describe("bakeTransformIntoCalibration", () => {
  it("round-trips a manual rotation through re-fit", () => {
    const transform = { offsetX: 0.1, offsetY: -0.05, scale: 1.2, rotationDeg: 90 };
    const baked = bakeTransformIntoCalibration(
      [
        { x: 0.2, y: 0.3 },
        { x: 0.8, y: 0.3 },
      ],
      transform,
      { pageWidth: 842, pageHeight: 595 },
    );
    const recovered = computeTransformFromCalibration(baked);
    expect(recovered.scale).toBeCloseTo(transform.scale, 5);
    expect(recovered.rotationDeg).toBeCloseTo(transform.rotationDeg, 4);
    expect(recovered.offsetX).toBeCloseTo(transform.offsetX, 5);
    expect(recovered.offsetY).toBeCloseTo(transform.offsetY, 5);
    expect(baked.pageWidth).toBe(842);
  });

  it("maps pdf picks through applyTransformToPoint", () => {
    const transform = { offsetX: 0, offsetY: 0, scale: 2, rotationDeg: 0 };
    const p = applyTransformToPoint(0.25, 0.4, transform);
    expect(p.x).toBeCloseTo(0.5, 5);
    expect(p.y).toBeCloseTo(0.8, 5);
  });
});

describe("overlayTransformCss", () => {
  it("uses top-left origin so CSS matches similarity math", () => {
    const css = overlayTransformCss({
      offsetX: 0.1,
      offsetY: 0.2,
      scale: 1.5,
      rotationDeg: -45,
    });
    expect(css.transformOrigin).toBe("0 0");
    expect(css.transform).toContain("translate(10%, 20%)");
    expect(css.transform).toContain("scale(1.5)");
    expect(css.transform).toContain("rotate(-45deg)");
  });
});

describe("snapRotationDeg", () => {
  it("snaps to nearest 90°", () => {
    expect(snapRotationDeg(10)).toBe(0);
    expect(snapRotationDeg(50)).toBe(90);
    expect(snapRotationDeg(-100)).toBe(-90);
  });
});

describe("cut display rotation", () => {
  it("snaps to 0/90/180/270", () => {
    expect(snapCutDisplayRotation(10)).toBe(0);
    expect(snapCutDisplayRotation(100)).toBe(90);
    expect(snapCutDisplayRotation(200)).toBe(180);
    expect(snapCutDisplayRotation(-90)).toBe(270);
  });

  it("inverts a 180° display pick around center", () => {
    const stored = invertCutDisplayPick({ x: 0.2, y: 0.3 }, 180);
    expect(stored.x).toBeCloseTo(0.8, 5);
    expect(stored.y).toBeCloseTo(0.7, 5);
  });

  it("round-trips 90° display picks", () => {
    const raw = { x: 0.2, y: 0.1 };
    const stored = invertCutDisplayPick(raw, 90);
    const visual = rotateNormAroundCenter(stored, 90);
    expect(visual.x).toBeCloseTo(raw.x, 5);
    expect(visual.y).toBeCloseTo(raw.y, 5);
  });
});

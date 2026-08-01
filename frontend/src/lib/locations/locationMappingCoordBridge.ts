import {
  buildTransformFromControlPoints,
  pdfNormToUser,
  type DrawingCoordTransform,
} from "@/lib/bim/drawingCoordBridge";
import { mapToWorld, PLAN_BAKE_PX, type PlanMinimapBounds } from "@/lib/bim/planMinimap";
import type { CalibrationInput } from "@/lib/api-client/locations";

function planNormToWorldXZ(
  norm: { x: number; y: number },
  bounds: PlanMinimapBounds,
  mapPx: number = PLAN_BAKE_PX,
): { x: number; z: number } {
  const mapX = norm.x * mapPx;
  const mapY = norm.y * mapPx;
  return mapToWorld(mapX, mapY, bounds, mapPx);
}

function estimateMmPerPdfUnit(
  calibration: CalibrationInput,
  bounds: PlanMinimapBounds,
  pageWidthPt: number,
  pageHeightPt: number,
  mapPx: number,
): number {
  const [p0, p1] = calibration.pointPairs;
  const u0 = pdfNormToUser(p0.pdf, pageWidthPt, pageHeightPt);
  const u1 = pdfNormToUser(p1.pdf, pageWidthPt, pageHeightPt);
  const pdfDist = Math.hypot(u1.u - u0.u, u1.v - u0.v);
  const w0 = planNormToWorldXZ(p0.plan, bounds, mapPx);
  const w1 = planNormToWorldXZ(p1.plan, bounds, mapPx);
  const worldDist = Math.hypot(w1.x - w0.x, w1.z - w0.z);
  if (pdfDist <= 1e-6 || worldDist <= 1e-9) return 1;
  return (worldDist * 1000) / pdfDist;
}

/** Build a BIM viewer coord transform from a locations/building 2D registration. */
export function buildCoordTransformFromLocationCalibration(
  calibration: CalibrationInput,
  bounds: PlanMinimapBounds,
  pageWidthPt: number = calibration.pageWidth ?? 612,
  pageHeightPt: number = calibration.pageHeight ?? 792,
  mapPx: number = PLAN_BAKE_PX,
): DrawingCoordTransform {
  const widthPt = pageWidthPt > 0 ? pageWidthPt : 612;
  const heightPt = pageHeightPt > 0 ? pageHeightPt : 792;
  const controlPoints = calibration.pointPairs.map((pair) => ({
    pdfNorm: pair.pdf,
    worldXZ: planNormToWorldXZ(pair.plan, bounds, mapPx),
  }));
  const mmPerPdfUnit = estimateMmPerPdfUnit(calibration, bounds, widthPt, heightPt, mapPx);
  return buildTransformFromControlPoints(controlPoints, mmPerPdfUnit, widthPt, heightPt);
}

export function isLocationCalibration(value: unknown): value is CalibrationInput {
  if (!value || typeof value !== "object") return false;
  const pairs = (value as CalibrationInput).pointPairs;
  return Array.isArray(pairs) && pairs.length >= 2;
}

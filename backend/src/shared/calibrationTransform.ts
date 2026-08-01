import { fitSimilarityTransform } from "./drawingCoordBridge.js";

export type CalibrationPointPair = {
  pdf: { x: number; y: number };
  plan: { x: number; y: number };
};

export type CalibrationInput = {
  pointPairs: [CalibrationPointPair, CalibrationPointPair];
  pageIndex?: number;
  pageWidth?: number;
  pageHeight?: number;
};

export type OverlayTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotationDeg: number;
};

/** Similarity fit from PDF-norm → plan-norm control pairs (shared FE/BE). */
export function computeTransformFromCalibration(calibration: CalibrationInput): OverlayTransform {
  const pairs = calibration.pointPairs.map((p) => ({
    src: { x: p.pdf.x, z: p.pdf.y },
    dst: { x: p.plan.x, z: p.plan.y },
  }));
  const { scale, rotationRad, translation } = fitSimilarityTransform(pairs);
  return {
    offsetX: translation.x,
    offsetY: translation.z,
    scale,
    rotationDeg: (rotationRad * 180) / Math.PI,
  };
}

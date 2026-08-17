"use client";

import type { CalibrationInput } from "@/lib/api-client/locations";
import type { OverlayTransform } from "@/lib/bim/drawingCoordBridge";

export {
  computeTransformFromCalibration,
  type OverlayTransform,
} from "@/lib/bim/drawingCoordBridge";

/** Map a PDF norm point → plan norm using the same similarity as the backend fit. */
export function applyTransformToPoint(
  x: number,
  y: number,
  transform: OverlayTransform,
): { x: number; y: number } {
  const rad = (transform.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = cos * x - sin * y;
  const ry = sin * x + cos * y;
  return {
    x: transform.scale * rx + transform.offsetX,
    y: transform.scale * ry + transform.offsetY,
  };
}

/**
 * CSS transform matching `applyTransformToPoint` / `fitSimilarityTransform`.
 * Must use origin top-left (0 0) — center-origin CSS does not match the math.
 */
export function overlayTransformCss(transform: OverlayTransform): {
  transform: string;
  transformOrigin: string;
} {
  return {
    transformOrigin: "0 0",
    transform: `translate(${transform.offsetX * 100}%, ${transform.offsetY * 100}%) scale(${transform.scale}) rotate(${transform.rotationDeg}deg)`,
  };
}

/**
 * Rebuild calibration point pairs so a re-fit recovers `transform` exactly.
 * Keeps the user's PDF picks; plan side becomes the fine-tuned mapping.
 */
export function bakeTransformIntoCalibration(
  pdfPoints: [{ x: number; y: number }, { x: number; y: number }],
  transform: OverlayTransform,
  extras?: Pick<CalibrationInput, "pageIndex" | "pageWidth" | "pageHeight">,
): CalibrationInput {
  return {
    pointPairs: [
      {
        pdf: pdfPoints[0],
        plan: applyTransformToPoint(pdfPoints[0].x, pdfPoints[0].y, transform),
      },
      {
        pdf: pdfPoints[1],
        plan: applyTransformToPoint(pdfPoints[1].x, pdfPoints[1].y, transform),
      },
    ],
    ...extras,
  };
}

/** Snap degrees to the nearest multiple of `step` (default 90°). */
export function snapRotationDeg(deg: number, step = 90): number {
  const s = step > 0 ? step : 90;
  return Math.round(deg / s) * s;
}

export type CutDisplayRotation = 0 | 90 | 180 | 270;

/** Quarter-turn display rotation for the IFC cut (does not change world mapping). */
export function snapCutDisplayRotation(deg: number): CutDisplayRotation {
  const n = (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
  if (n === 90 || n === 180 || n === 270) return n;
  return 0;
}

/**
 * Rotate a normalized (0–1) point around the sheet center.
 * Matches CSS `rotate()` on a Y-down canvas (positive = clockwise).
 */
export function rotateNormAroundCenter(
  p: { x: number; y: number },
  deg: number,
): { x: number; y: number } {
  if (!deg) return { x: p.x, y: p.y };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - 0.5;
  const dy = p.y - 0.5;
  return {
    x: 0.5 + cos * dx - sin * dy,
    y: 0.5 + sin * dx + cos * dy,
  };
}

/** Convert a click on the rotated cut display into unrotated plan UV. */
export function invertCutDisplayPick(
  p: { x: number; y: number },
  deg: CutDisplayRotation,
): { x: number; y: number } {
  return rotateNormAroundCenter(p, -deg);
}

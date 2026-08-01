/** Shared Google Maps–style navigator sizing and hit-testing. */

export const MAP_NAV_COLORS = {
  dot: "#4285F4",
  dotStroke: "#ffffff",
  beam: "rgba(66, 133, 244, 0.28)",
  beamStroke: "rgba(26, 115, 232, 0.45)",
  shadow: "rgba(15, 23, 42, 0.22)",
} as const;

export type MapNavigatorHit = { kind: "none" } | { kind: "pan" } | { kind: "rotate" };

function scalePx(canvasW: number, canvasH: number): number {
  return Math.min(canvasW, canvasH);
}

export function mapNavigatorMetrics(canvasW: number, canvasH: number) {
  const s = scalePx(canvasW, canvasH);
  // Cap sizes so the peg stays small on large 2D drawings; floors keep it usable on minimaps.
  return {
    centerR: Math.min(11, Math.max(7, s * 0.015)),
    rotateInnerR: Math.min(15, Math.max(10, s * 0.02)),
    beamLen: Math.min(40, Math.max(22, s * 0.055)),
    beamHalfWidth: Math.min(11, Math.max(6, s * 0.02)),
    fovHalfRad: Math.PI / 5.5,
  };
}

/** Hit test in canvas pixel coordinates (origin top-left). */
export function hitTestMapNavigator(
  px: number,
  py: number,
  anchorPx: number,
  anchorPy: number,
  canvasW: number,
  canvasH: number,
): MapNavigatorHit {
  const { centerR, rotateInnerR, beamLen } = mapNavigatorMetrics(canvasW, canvasH);
  const dx = px - anchorPx;
  const dy = py - anchorPy;
  const dist = Math.hypot(dx, dy);

  if (dist <= centerR + 4) return { kind: "pan" };
  if (dist >= rotateInnerR && dist <= beamLen + 12) return { kind: "rotate" };
  return { kind: "none" };
}

/** Draw Google Maps–style navigator on a 2D canvas (plan minimap). */
export function drawMapNavigatorCanvas(
  ctx: CanvasRenderingContext2D,
  anchorPx: number,
  anchorPy: number,
  headingRad: number,
  fovHalfRad: number,
  canvasW: number,
  canvasH: number,
): void {
  const { centerR, beamLen, beamHalfWidth } = mapNavigatorMetrics(canvasW, canvasH);

  ctx.save();
  ctx.translate(anchorPx, anchorPy);
  ctx.rotate(headingRad);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-Math.sin(fovHalfRad) * beamLen, -Math.cos(fovHalfRad) * beamLen);
  ctx.arc(0, 0, beamLen, -Math.PI / 2 - fovHalfRad, -Math.PI / 2 + fovHalfRad, false);
  ctx.closePath();
  ctx.fillStyle = MAP_NAV_COLORS.beam;
  ctx.fill();
  ctx.strokeStyle = MAP_NAV_COLORS.beamStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.shadowColor = MAP_NAV_COLORS.shadow;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(0, 0, centerR + 3, 0, Math.PI * 2);
  ctx.fillStyle = MAP_NAV_COLORS.dotStroke;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  ctx.fillStyle = MAP_NAV_COLORS.dot;
  ctx.fill();
  ctx.strokeStyle = MAP_NAV_COLORS.dotStroke;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -centerR * 0.45);
  ctx.lineTo(centerR * 0.38, centerR * 0.42);
  ctx.lineTo(-centerR * 0.38, centerR * 0.42);
  ctx.closePath();
  ctx.fillStyle = MAP_NAV_COLORS.dotStroke;
  ctx.fill();

  ctx.restore();
}

export const PLAN_MINIMAP_PX = 260;
export const PLAN_BAKE_PX = 512;
const PLAN_MINIMAP_PAD = 12;

export type PlanMinimapBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type PlanMinimapState = {
  anchorX: number;
  anchorZ: number;
  heading: number;
  fovHalfRad: number;
  bounds: PlanMinimapBounds | null;
  silhouette: ImageBitmap | null;
  /** Pixel size the silhouette was baked at (defaults to PLAN_BAKE_PX). */
  silhouetteBakePx?: number;
  baking: boolean;
  activeStorey: string | null;
};

export type PlanMinimapPose = {
  x: number;
  z: number;
  heading?: number;
  animate?: boolean;
};

type PlanMinimapTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
};

export type PlanMinimapHit =
  | { kind: "none" }
  | { kind: "pan" }
  | { kind: "rotate" }
  | { kind: "jump"; worldX: number; worldZ: number };

import { drawMapNavigatorCanvas, hitTestMapNavigator } from "@/lib/bim/bimMapNavigator";

/** BIM token-aligned plan colors (see .bim-viewer in globals.css). */
const PLAN_COLORS = {
  shell: "#f8fafc",
  sheet: "#ffffff",
  sheetBorder: "#cbd5e1",
  grid: "rgba(148, 163, 184, 0.22)",
  footprint: "#e2e8f0",
  ink: "#334155",
  muted: "#64748b",
  subtle: "#94a3b8",
  accent: "#3B82F6",
  accentSoft: "rgba(59, 130, 246, 0.16)",
  accentLine: "rgba(59, 130, 246, 0.42)",
} as const;

function getPlanMinimapTransform(bounds: PlanMinimapBounds, mapPx: number): PlanMinimapTransform {
  const inner = mapPx - PLAN_MINIMAP_PAD * 2;
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.001);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 0.001);
  const scale = Math.min(inner / spanX, inner / spanZ);
  const drawW = spanX * scale;
  const drawH = spanZ * scale;
  const offsetX = PLAN_MINIMAP_PAD + (inner - drawW) / 2;
  const offsetY = PLAN_MINIMAP_PAD + (inner - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH };
}

export function worldToMap(
  x: number,
  z: number,
  bounds: PlanMinimapBounds,
  mapPx: number,
): { x: number; y: number } {
  const t = getPlanMinimapTransform(bounds, mapPx);
  return {
    x: t.offsetX + (x - bounds.minX) * t.scale,
    y: t.offsetY + (bounds.maxZ - z) * t.scale,
  };
}

export function mapToWorld(
  mapX: number,
  mapY: number,
  bounds: PlanMinimapBounds,
  mapPx: number,
): { x: number; z: number } {
  const t = getPlanMinimapTransform(bounds, mapPx);
  return {
    x: bounds.minX + (mapX - t.offsetX) / t.scale,
    z: bounds.maxZ - (mapY - t.offsetY) / t.scale,
  };
}

// fallow-ignore-next-line complexity
export function hitTestPlanMinimap(
  mapX: number,
  mapY: number,
  mapPx: number,
  state: PlanMinimapState,
): PlanMinimapHit {
  if (!state.bounds) return { kind: "none" };

  const anchor = worldToMap(state.anchorX, state.anchorZ, state.bounds, mapPx);
  const hit = hitTestMapNavigator(mapX, mapY, anchor.x, anchor.y, mapPx, mapPx);
  if (hit.kind !== "none") return hit;

  const t = getPlanMinimapTransform(state.bounds, mapPx);
  const inFootprint =
    mapX >= t.offsetX &&
    mapX <= t.offsetX + t.drawW &&
    mapY >= t.offsetY &&
    mapY <= t.offsetY + t.drawH;

  if (inFootprint) {
    const world = mapToWorld(mapX, mapY, state.bounds, mapPx);
    return { kind: "jump", worldX: world.x, worldZ: world.z };
  }

  return { kind: "none" };
}

function drawPlanGrid(
  ctx: CanvasRenderingContext2D,
  tl: { x: number; y: number },
  footprintW: number,
  footprintH: number,
): void {
  ctx.strokeStyle = PLAN_COLORS.grid;
  ctx.lineWidth = 0.5;
  const gridStep = Math.max(footprintW, footprintH) / 4;
  for (let i = 1; i < 4; i++) {
    const gx = tl.x + gridStep * i;
    const gy = tl.y + gridStep * i;
    ctx.beginPath();
    ctx.moveTo(gx, tl.y);
    ctx.lineTo(gx, tl.y + footprintH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tl.x, gy);
    ctx.lineTo(tl.x + footprintW, gy);
    ctx.stroke();
  }
}

function drawPlanSheetFrame(
  ctx: CanvasRenderingContext2D,
  tl: { x: number; y: number },
  w: number,
  h: number,
): void {
  ctx.fillStyle = PLAN_COLORS.sheet;
  ctx.strokeStyle = PLAN_COLORS.sheetBorder;
  ctx.lineWidth = 1;
  const r = 6;
  ctx.beginPath();
  ctx.roundRect(tl.x, tl.y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

export function drawPlanMinimap(
  ctx: CanvasRenderingContext2D,
  mapPx: number,
  state: PlanMinimapState,
  options?: { hideNavigator?: boolean },
): void {
  ctx.clearRect(0, 0, mapPx, mapPx);
  ctx.fillStyle = PLAN_COLORS.shell;
  ctx.fillRect(0, 0, mapPx, mapPx);

  if (!state.bounds) {
    ctx.fillStyle = PLAN_COLORS.subtle;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Plan view", mapPx / 2, mapPx / 2 - 7);
    ctx.fillStyle = PLAN_COLORS.muted;
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.fillText("Open a model to navigate", mapPx / 2, mapPx / 2 + 9);
    return;
  }

  const bounds = state.bounds;
  const t = getPlanMinimapTransform(bounds, mapPx);
  const tl = { x: t.offsetX, y: t.offsetY };

  drawPlanSheetFrame(ctx, tl, t.drawW, t.drawH);

  const clipSheet = (paint: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tl.x + 1, tl.y + 1, t.drawW - 2, t.drawH - 2, 5);
    ctx.clip();
    paint();
    ctx.restore();
  };

  if (state.silhouette) {
    const bakePx = state.silhouetteBakePx ?? PLAN_BAKE_PX;
    const src = getPlanMinimapTransform(bounds, bakePx);
    clipSheet(() => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        state.silhouette!,
        src.offsetX,
        src.offsetY,
        src.drawW,
        src.drawH,
        tl.x + 1,
        tl.y + 1,
        t.drawW - 2,
        t.drawH - 2,
      );
    });
  } else {
    clipSheet(() => {
      ctx.fillStyle = PLAN_COLORS.footprint;
      ctx.fillRect(tl.x + 1, tl.y + 1, t.drawW - 2, t.drawH - 2);
      drawPlanGrid(ctx, { x: tl.x + 1, y: tl.y + 1 }, t.drawW - 2, t.drawH - 2);
    });
  }

  if (state.baking) {
    ctx.fillStyle = "rgba(248, 250, 252, 0.82)";
    ctx.beginPath();
    ctx.roundRect(tl.x + 1, tl.y + 1, t.drawW - 2, t.drawH - 2, 5);
    ctx.fill();
    ctx.fillStyle = PLAN_COLORS.muted;
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Updating plan…", tl.x + t.drawW / 2, tl.y + t.drawH / 2);
  }

  if (!options?.hideNavigator) {
    const anchor = worldToMap(state.anchorX, state.anchorZ, bounds, mapPx);
    drawMapNavigatorCanvas(ctx, anchor.x, anchor.y, state.heading, state.fovHalfRad, mapPx, mapPx);
  }
}

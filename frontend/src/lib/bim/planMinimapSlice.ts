import * as THREE from "three";
import type * as FRAGS from "@thatopen/fragments";
import { PLAN_BAKE_PX, worldToMap, type PlanMinimapBounds } from "@/lib/bim/planMinimap";

const WALL_STROKE = "#1e293b";
const ROOM_FILL = "#e8edf3";
const ROOM_STROKE = "#cbd5e1";
const SHEET_BG = "#ffffff";

const PLAN_IFC_CATEGORIES = new Set([
  "IfcWall",
  "IfcWallStandardCase",
  "IfcCurtainWall",
  "IfcSlab",
  "IfcSpace",
  "IfcDoor",
  "IfcWindow",
  "IfcColumn",
  "IfcBeam",
  "IfcCovering",
  "IfcPlate",
  "IfcRailing",
  "IfcStair",
  "IfcRoof",
  "IfcBuildingElementProxy",
  "IfcMember",
  "IfcFooting",
  "IfcPile",
]);

export const PLAN_GEOMETRY_ITEM_CAP = 800;
const PLAN_GEOMETRY_BATCH = 24;

export function boundsFromBox3(box: THREE.Box3): PlanMinimapBounds {
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
  };
}

function planSliceHeight(bounds: THREE.Box3, _units: "m" | "mm"): number {
  void _units;
  const center = bounds.getCenter(new THREE.Vector3());
  return center.y;
}

function planSliceBand(bounds: THREE.Box3, units: "m" | "mm"): number {
  const height = Math.max(bounds.max.y - bounds.min.y, units === "mm" ? 500 : 0.5);
  const minBand = units === "mm" ? 2000 : 2;
  return Math.max(height * 0.6, minBand);
}

export function filterPlanCategories(available: Iterable<string>): string[] {
  return [...available].filter((name) => PLAN_IFC_CATEGORIES.has(name));
}

const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _vc = new THREE.Vector3();
const _edge = new THREE.Vector3();
const _normal = new THREE.Vector3();

function readWorldVertex(
  positions: Float32Array | Float64Array,
  index: number,
  matrix: THREE.Matrix4,
  target: THREE.Vector3,
): THREE.Vector3 {
  const i = index * 3;
  return target.set(positions[i]!, positions[i + 1]!, positions[i + 2]!).applyMatrix4(matrix);
}

function pushSlicePoint(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  sliceY: number,
  out: THREE.Vector3[],
): void {
  if (Math.abs(p1.y - p2.y) < 1e-9) return;
  if ((p1.y - sliceY) * (p2.y - sliceY) > 0) return;
  const t = (sliceY - p1.y) / (p2.y - p1.y);
  out.push(new THREE.Vector3(p1.x + t * (p2.x - p1.x), sliceY, p1.z + t * (p2.z - p1.z)));
}

function dedupePoints(points: THREE.Vector3[], eps: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const p of points) {
    if (!out.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < eps)) out.push(p);
  }
  return out;
}

function mapPoint(
  p: THREE.Vector3,
  bounds: PlanMinimapBounds,
  px: number,
): { x: number; y: number } {
  return worldToMap(p.x, p.z, bounds, px);
}

function drawSegment(
  ctx: CanvasRenderingContext2D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  bounds: PlanMinimapBounds,
  px: number,
  width: number,
): void {
  const p1 = mapPoint(a, bounds, px);
  const p2 = mapPoint(b, bounds, px);
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (len < 0.35) return;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawFillTriangle(
  ctx: CanvasRenderingContext2D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  bounds: PlanMinimapBounds,
  px: number,
): void {
  const p1 = mapPoint(a, bounds, px);
  const p2 = mapPoint(b, bounds, px);
  const p3 = mapPoint(c, bounds, px);
  const area = Math.abs(p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2;
  if (area < 0.5) return;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.fill();
}

function triangleInSliceBand(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  sliceY: number,
  sliceBand: number,
): boolean {
  const minY = Math.min(a.y, b.y, c.y);
  const maxY = Math.max(a.y, b.y, c.y);
  return !(maxY < sliceY - sliceBand || minY > sliceY + sliceBand);
}

// fallow-ignore-next-line complexity
function processMeshFills(
  mesh: FRAGS.MeshData,
  matrix: THREE.Matrix4,
  sliceY: number,
  sliceBand: number,
  ctx: CanvasRenderingContext2D,
  bounds: PlanMinimapBounds,
  px: number,
): void {
  const positions = mesh.positions;
  const indices = mesh.indices;
  if (!positions || !indices || indices.length < 3) return;

  for (let i = 0; i + 2 < indices.length; i += 3) {
    readWorldVertex(positions, indices[i]!, matrix, _va);
    readWorldVertex(positions, indices[i + 1]!, matrix, _vb);
    readWorldVertex(positions, indices[i + 2]!, matrix, _vc);

    _edge.subVectors(_vb, _va);
    _normal.subVectors(_vc, _va);
    _normal.crossVectors(_edge, _normal);
    if (_normal.lengthSq() < 1e-12) continue;
    _normal.normalize();

    if (!triangleInSliceBand(_va, _vb, _vc, sliceY, sliceBand)) continue;
    const avgY = (_va.y + _vb.y + _vc.y) / 3;

    if (_normal.y > 0.45 && Math.abs(avgY - sliceY) <= sliceBand) {
      drawFillTriangle(ctx, _va, _vb, _vc, bounds, px);
    }
  }
}

// fallow-ignore-next-line complexity
function processMeshStrokes(
  mesh: FRAGS.MeshData,
  matrix: THREE.Matrix4,
  sliceY: number,
  sliceBand: number,
  ctx: CanvasRenderingContext2D,
  bounds: PlanMinimapBounds,
  px: number,
  units: "m" | "mm",
): void {
  const positions = mesh.positions;
  const indices = mesh.indices;
  if (!positions || !indices || indices.length < 3) return;

  const eps = units === "mm" ? 50 : 0.05;
  const minEdge = units === "mm" ? 40 : 0.04;

  for (let i = 0; i + 2 < indices.length; i += 3) {
    readWorldVertex(positions, indices[i]!, matrix, _va);
    readWorldVertex(positions, indices[i + 1]!, matrix, _vb);
    readWorldVertex(positions, indices[i + 2]!, matrix, _vc);

    if (!triangleInSliceBand(_va, _vb, _vc, sliceY, sliceBand)) continue;

    const hits: THREE.Vector3[] = [];
    pushSlicePoint(_va, _vb, sliceY, hits);
    pushSlicePoint(_vb, _vc, sliceY, hits);
    pushSlicePoint(_vc, _va, sliceY, hits);
    const cut = dedupePoints(hits, eps);
    if (cut.length >= 2) {
      const segLen = Math.hypot(cut[0]!.x - cut[1]!.x, cut[0]!.z - cut[1]!.z);
      if (segLen >= minEdge) {
        drawSegment(ctx, cut[0]!, cut[1]!, bounds, px, 1.6);
      }
    }
  }
}

// fallow-ignore-next-line complexity
async function drawBoxOutlines(
  ctx: CanvasRenderingContext2D,
  fragments: Map<string, FRAGS.FragmentsModel>,
  elementsByModel: Map<string, number[]>,
  bounds: PlanMinimapBounds,
  px: number,
): Promise<void> {
  ctx.strokeStyle = WALL_STROKE;
  ctx.lineWidth = 1.1;
  for (const [modelId, localIds] of elementsByModel) {
    const model = fragments.get(modelId);
    if (!model || localIds.length === 0) continue;
    for (let i = 0; i < localIds.length; i += 120) {
      const chunk = localIds.slice(i, i + 120);
      try {
        const boxes = await model.getBoxes(chunk);
        for (const box of boxes) {
          if (box.isEmpty()) continue;
          const tl = worldToMap(box.min.x, box.max.z, bounds, px);
          const br = worldToMap(box.max.x, box.min.z, bounds, px);
          const w = br.x - tl.x;
          const h = br.y - tl.y;
          if (w < 0.4 || h < 0.4) continue;
          ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w - 1, h - 1);
        }
      } catch {
        /* skip chunk */
      }
    }
  }
}

// fallow-ignore-next-line complexity
function canvasHasInk(ctx: CanvasRenderingContext2D, px: number): boolean {
  const sample = ctx.getImageData(0, 0, px, px).data;
  for (let i = 0; i < sample.length; i += 16) {
    const r = sample[i]!;
    const g = sample[i + 1]!;
    const b = sample[i + 2]!;
    if (r < 245 || g < 245 || b < 245) return true;
  }
  return false;
}

// fallow-ignore-next-line complexity
async function rasterizeElements(
  ctx: CanvasRenderingContext2D,
  args: PlanSliceBakeArgs,
  sliceY: number,
  sliceBand: number,
  pass: "fill" | "stroke",
): Promise<number> {
  const { fragments, elementsByModel, bounds, units } = args;
  const px = Math.max(256, Math.round(args.bakePx ?? PLAN_BAKE_PX));
  let processed = 0;

  for (const [modelId, localIds] of elementsByModel) {
    const model = fragments.get(modelId);
    if (!model || localIds.length === 0) continue;
    model.object.updateMatrixWorld(true);
    const modelMatrix = model.object.matrixWorld;

    for (let i = 0; i < localIds.length; i += PLAN_GEOMETRY_BATCH) {
      if (processed >= PLAN_GEOMETRY_ITEM_CAP) return processed;
      const chunk = localIds.slice(i, i + PLAN_GEOMETRY_BATCH);
      try {
        const groups = await model.getItemsGeometry(chunk);
        for (const group of groups) {
          const meshes = Array.isArray(group) ? group : group ? [group] : [];
          if (meshes.length === 0) continue;
          for (const mesh of meshes) {
            const matrix = new THREE.Matrix4().multiplyMatrices(modelMatrix, mesh.transform);
            if (pass === "fill") {
              processMeshFills(mesh, matrix, sliceY, sliceBand, ctx, bounds, px);
            } else {
              processMeshStrokes(mesh, matrix, sliceY, sliceBand, ctx, bounds, px, units);
            }
          }
        }
        processed += chunk.length;
      } catch {
        /* try next chunk */
      }
    }
  }
  return processed;
}

export type PlanSliceBakeArgs = {
  fragments: Map<string, FRAGS.FragmentsModel>;
  elementsByModel: Map<string, number[]>;
  bounds: PlanMinimapBounds;
  worldBounds: THREE.Box3;
  units: "m" | "mm";
  /** Output resolution in px; defaults to PLAN_BAKE_PX (512). Higher = crisper full-pane plans. */
  bakePx?: number;
};

/** Slice fragment geometry at floor height and draw walls / room fills. */
// fallow-ignore-next-line complexity
export async function bakePlanFromSlice(args: PlanSliceBakeArgs): Promise<ImageBitmap | null> {
  const { fragments, elementsByModel, bounds, worldBounds, units } = args;
  if (worldBounds.isEmpty()) return null;

  const px = Math.max(256, Math.round(args.bakePx ?? PLAN_BAKE_PX));

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = SHEET_BG;
  ctx.fillRect(0, 0, px, px);

  const sliceY = planSliceHeight(worldBounds, units);
  const sliceBand = planSliceBand(worldBounds, units);

  ctx.fillStyle = ROOM_FILL;
  await rasterizeElements(ctx, args, sliceY, sliceBand, "fill");

  ctx.strokeStyle = WALL_STROKE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  await rasterizeElements(ctx, args, sliceY, sliceBand, "stroke");

  if (!canvasHasInk(ctx, px)) {
    await drawBoxOutlines(ctx, fragments, elementsByModel, bounds, px);
  }

  ctx.strokeStyle = ROOM_STROKE;
  ctx.lineWidth = 0.75;
  const tl = worldToMap(bounds.minX, bounds.maxZ, bounds, px);
  const br = worldToMap(bounds.maxX, bounds.minZ, bounds, px);
  ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, br.x - tl.x - 1, br.y - tl.y - 1);

  if (typeof createImageBitmap === "function") {
    return createImageBitmap(canvas);
  }
  return null;
}

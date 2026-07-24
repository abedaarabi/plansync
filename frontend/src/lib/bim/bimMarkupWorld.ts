import { camerasMatch } from "@/lib/bim/bimMarkupCamera";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import type { BimAnnotation } from "@/store/bimMarkupStore";

export type BimWorldPoint = { x: number; y: number; z: number };

/** Reduce freehand point count before 3D raycasting. */
// fallow-ignore-next-line complexity
export function decimateNormPoints(
  points: { x: number; y: number }[],
  minDist = 0.004,
): { x: number; y: number }[] {
  if (points.length <= 2) return points.map((p) => ({ ...p }));
  const out: { x: number; y: number }[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push({ ...p });
  }
  const tail = points[points.length - 1]!;
  const end = out[out.length - 1]!;
  if (end.x !== tail.x || end.y !== tail.y) out.push({ ...tail });
  return out;
}

async function raycastNormPointsToWorld(
  engine: BimEngine,
  points: { x: number; y: number }[],
): Promise<BimWorldPoint[]> {
  const worldPoints: BimWorldPoint[] = [];
  for (const p of points) {
    const hit = await engine.raycastAtNorm(p.x, p.y);
    if (hit) worldPoints.push(hit);
  }
  return worldPoints;
}

function projectWorldPointsToNorm(
  engine: BimEngine,
  worldPoints: BimWorldPoint[],
  cssW: number,
  cssH: number,
): { points: { x: number; y: number }[]; anyVisible: boolean } {
  const points: { x: number; y: number }[] = [];
  let anyVisible = false;
  for (const wp of worldPoints) {
    const projected = engine.projectWorldToScreen(wp.x, wp.y, wp.z);
    if (!projected) continue;
    if (projected.visible) anyVisible = true;
    points.push({
      x: projected.x / cssW,
      y: projected.y / cssH,
    });
  }
  return { points, anyVisible };
}

/** Resolve screen-normalized points for the current camera (3D-anchored or legacy view-locked). */
// fallow-ignore-next-line complexity
export function projectAnnotationForDisplay(
  engine: BimEngine,
  annotation: BimAnnotation,
  cssW: number,
  cssH: number,
  currentCamera: Record<string, unknown>,
): BimAnnotation | null {
  if (annotation.worldPoints?.length) {
    const { points, anyVisible } = projectWorldPointsToNorm(
      engine,
      annotation.worldPoints,
      cssW,
      cssH,
    );
    if (points.length === 0) return null;
    if (!anyVisible) return null;
    return { ...annotation, points };
  }

  if (!camerasMatch(annotation.cameraJson, currentCamera)) return null;
  return annotation;
}

export function projectedAnnotationsKey(annotations: BimAnnotation[]): string {
  return annotations
    .map((a) =>
      a.points.map((p) => `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`).join(","),
    )
    .join("|");
}

export async function anchorAnnotationToWorld(
  engine: BimEngine,
  points: { x: number; y: number }[],
): Promise<BimWorldPoint[] | undefined> {
  const sample =
    points.length > 80 ? decimateNormPoints(points, 0.006) : points.map((p) => ({ ...p }));
  const worldPoints = await raycastNormPointsToWorld(engine, sample);
  return worldPoints.length > 0 ? worldPoints : undefined;
}

/** One-time migration for markups saved before 3D anchoring. */
// fallow-ignore-next-line complexity
async function migrateLegacyAnnotation(
  engine: BimEngine,
  annotation: BimAnnotation,
  opts?: { skipCamera?: boolean },
): Promise<BimAnnotation> {
  if (annotation.worldPoints?.length) return annotation;
  if (annotation.points.length === 0) return annotation;

  if (!opts?.skipCamera) {
    await engine.applyCameraState(annotation.cameraJson);
  }
  const worldPoints = await anchorAnnotationToWorld(engine, annotation.points);
  if (!worldPoints?.length) return annotation;

  const sample =
    annotation.points.length > 80
      ? decimateNormPoints(annotation.points, 0.006)
      : annotation.points;

  return {
    ...annotation,
    points: sample.length === worldPoints.length ? sample : annotation.points,
    worldPoints,
  };
}

// fallow-ignore-next-line complexity
export async function migrateLegacyBimMarkups(
  engine: BimEngine,
  annotations: BimAnnotation[],
): Promise<BimAnnotation[]> {
  const pending = annotations.filter((a) => !a.worldPoints?.length && a.points.length > 0);
  if (pending.length === 0) return annotations;

  const original = engine.getCameraState();
  const next = [...annotations];
  let changed = false;
  for (const ann of pending) {
    const idx = next.findIndex((a) => a.id === ann.id);
    if (idx < 0) continue;
    const migrated = await migrateLegacyAnnotation(engine, ann, { skipCamera: false });
    if (migrated.worldPoints?.length) {
      next[idx] = migrated;
      changed = true;
    }
  }
  await engine.applyCameraState(original);
  return changed ? next : annotations;
}

export function projectAnnotationsForDisplay(
  engine: BimEngine,
  annotations: BimAnnotation[],
  cssW: number,
  cssH: number,
): BimAnnotation[] {
  const cam = engine.getCameraState();
  return annotations
    .map((a) => projectAnnotationForDisplay(engine, a, cssW, cssH, cam))
    .filter((a): a is BimAnnotation => a != null);
}

export function markupHasWorldAnchor(annotation: BimAnnotation): boolean {
  return (annotation.worldPoints?.length ?? 0) > 0;
}

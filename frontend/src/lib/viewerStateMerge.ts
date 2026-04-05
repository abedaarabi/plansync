import type { Annotation, Calibration } from "@/store/viewerStore";
import type { ViewerStatePayload } from "@/lib/viewerStateCloud";
import { calibrationFromPersisted } from "@/lib/sessionPersistence";
import { VIEWER_SCALE_MAX, VIEWER_SCALE_MIN } from "@/store/viewerStore";

/** Merge server annotations with local: server wins on id clash; keep local-only ids not on server. */
export function mergeAnnotationsRemote(remote: Annotation[], local: Annotation[]): Annotation[] {
  const rmap = new Map(remote.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: Annotation[] = [];
  for (const a of remote) {
    out.push(a);
    seen.add(a.id);
  }
  for (const a of local) {
    if (!seen.has(a.id)) out.push(a);
  }
  return out;
}

export type MergedViewerStatePatch = Partial<{
  annotations: Annotation[];
  calibrationByPage: Record<string, Calibration>;
  scale: number;
  currentPage: number;
  measureUnit: ViewerStatePayload["measureUnit"];
  snapToGeometry: boolean;
  snapRadiusPx: number;
  takeoffItems: ViewerStatePayload["takeoffItems"];
  takeoffZones: ViewerStatePayload["takeoffZones"];
  takeoffPackageStatus: ViewerStatePayload["takeoffPackageStatus"];
}>;

export function buildMergePatchFromRemote(
  parsed: ViewerStatePayload,
  localAnnotations: Annotation[],
  numPages: number,
): MergedViewerStatePatch {
  return {
    annotations: mergeAnnotationsRemote(parsed.annotations, localAnnotations),
    calibrationByPage: calibrationFromPersisted(parsed.calibrationByPage),
    scale: Math.min(VIEWER_SCALE_MAX, Math.max(VIEWER_SCALE_MIN, parsed.scale ?? 1)),
    currentPage: Math.min(numPages, Math.max(1, parsed.currentPage ?? 1)),
    ...(parsed.measureUnit != null ? { measureUnit: parsed.measureUnit } : {}),
    ...(parsed.snapToGeometry != null ? { snapToGeometry: parsed.snapToGeometry } : {}),
    ...(parsed.snapRadiusPx != null ? { snapRadiusPx: parsed.snapRadiusPx } : {}),
    ...(parsed.takeoffItems != null ? { takeoffItems: parsed.takeoffItems } : {}),
    ...(parsed.takeoffZones != null ? { takeoffZones: parsed.takeoffZones } : {}),
    ...(parsed.takeoffPackageStatus != null
      ? { takeoffPackageStatus: parsed.takeoffPackageStatus }
      : {}),
  };
}

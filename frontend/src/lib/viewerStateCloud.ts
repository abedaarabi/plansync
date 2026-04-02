import type { MeasureUnit } from "@/lib/coords";
import type { TakeoffItem, TakeoffPackageStatus, TakeoffZone } from "@/lib/takeoffTypes";
import type { Annotation, Calibration } from "@/store/viewerStore";

/** Matches `FileVersion.annotationBlob` / PUT body (server adds `v: 1`). */
export type ViewerStatePayload = {
  annotations: Annotation[];
  calibrationByPage: Record<string, Calibration>;
  currentPage?: number;
  scale?: number;
  measureUnit?: MeasureUnit;
  snapToGeometry?: boolean;
  snapRadiusPx?: number;
  takeoffItems?: TakeoffItem[];
  takeoffZones?: TakeoffZone[];
  takeoffPackageStatus?: TakeoffPackageStatus;
};

export function parseServerViewerState(data: unknown): ViewerStatePayload | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.annotations)) return null;
  const calRaw = o.calibrationByPage;
  const calibrationByPage: Record<string, Calibration> =
    calRaw && typeof calRaw === "object" && !Array.isArray(calRaw)
      ? (calRaw as Record<string, Calibration>)
      : {};
  const takeoffItems = Array.isArray(o.takeoffItems)
    ? (o.takeoffItems as TakeoffItem[])
    : undefined;
  const takeoffZones = Array.isArray(o.takeoffZones)
    ? (o.takeoffZones as TakeoffZone[])
    : undefined;
  const takeoffPackageStatus =
    o.takeoffPackageStatus === "draft" ||
    o.takeoffPackageStatus === "checked" ||
    o.takeoffPackageStatus === "approved"
      ? (o.takeoffPackageStatus as TakeoffPackageStatus)
      : undefined;

  return {
    annotations: o.annotations as Annotation[],
    calibrationByPage,
    currentPage: typeof o.currentPage === "number" ? o.currentPage : undefined,
    scale: typeof o.scale === "number" ? o.scale : undefined,
    measureUnit: typeof o.measureUnit === "string" ? (o.measureUnit as MeasureUnit) : undefined,
    snapToGeometry: typeof o.snapToGeometry === "boolean" ? o.snapToGeometry : undefined,
    snapRadiusPx: typeof o.snapRadiusPx === "number" ? o.snapRadiusPx : undefined,
    takeoffItems,
    takeoffZones,
    takeoffPackageStatus,
  };
}

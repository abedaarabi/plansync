import { putViewerState } from "@/lib/api-client";
import type { ViewerStatePayload } from "@/lib/viewerStateCloud";
import { fileFingerprint, savePersistedSession } from "@/lib/sessionPersistence";
import { useViewerStore } from "@/store/viewerStore";

/** Full payload used for cloud PUT and local session save (keeps fields in sync). */
export function getViewerStateSyncPayload(): ViewerStatePayload {
  const s = useViewerStore.getState();
  return {
    annotations: s.annotations,
    calibrationByPage: Object.fromEntries(
      Object.entries(s.calibrationByPage).map(([k, v]) => [String(k), v]),
    ),
    currentPage: s.currentPage,
    scale: s.scale,
    measureUnit: s.measureUnit,
    snapToGeometry: s.snapToGeometry,
    snapRadiusPx: s.snapRadiusPx,
    takeoffItems: s.takeoffItems,
    takeoffZones: s.takeoffZones,
    takeoffPackageStatus: s.takeoffPackageStatus,
  };
}

/** Persist immediately (e.g. package status) so users do not rely only on the 500ms debounced save. */
export function persistViewerStateNow(): void {
  const s = useViewerStore.getState();
  const payload = getViewerStateSyncPayload();
  if (s.cloudFileVersionId) {
    void putViewerState(s.cloudFileVersionId, payload).catch(() => {
      /* offline */
    });
    return;
  }
  if (s.fileName && s.numPages >= 1) {
    savePersistedSession({
      fingerprint: fileFingerprint(s.fileName, s.numPages),
      currentPage: s.currentPage,
      scale: s.scale,
      annotations: s.annotations,
      calibrationByPage: payload.calibrationByPage,
      measureUnit: s.measureUnit,
      snapToGeometry: s.snapToGeometry,
      snapRadiusPx: s.snapRadiusPx,
      takeoffItems: s.takeoffItems,
      takeoffZones: s.takeoffZones,
      takeoffPackageStatus: s.takeoffPackageStatus,
    });
  }
}

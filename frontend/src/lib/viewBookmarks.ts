import type { MeasureUnit } from "@/lib/coords";
import type { TakeoffItem, TakeoffPackageStatus, TakeoffZone } from "@/lib/takeoffTypes";
import type { Annotation, Calibration } from "@/store/viewerStore";
import { fileFingerprint } from "@/lib/sessionPersistence";

const prefix = (fp: string) => `plansync-bookmarks-${fp}`;
const legacyPrefix = (fp: string) => `cv-bookmarks-${fp}`;

export type SavedViewBookmark = {
  id: string;
  name: string;
  page: number;
  scale: number;
  snapToGeometry: boolean;
  snapRadiusPx: number;
  snapLayerIds: string[] | null;
};

export function loadBookmarks(fileName: string | null, numPages: number): SavedViewBookmark[] {
  if (typeof window === "undefined" || !fileName || numPages < 1) return [];
  try {
    const fp = fileFingerprint(fileName, numPages);
    let raw = localStorage.getItem(prefix(fp));
    if (!raw) {
      raw = localStorage.getItem(legacyPrefix(fp));
      if (raw) {
        try {
          localStorage.setItem(prefix(fp), raw);
          localStorage.removeItem(legacyPrefix(fp));
        } catch {
          /* ignore migration */
        }
      }
    }
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (x): x is SavedViewBookmark =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as SavedViewBookmark).id === "string" &&
        typeof (x as SavedViewBookmark).name === "string" &&
        typeof (x as SavedViewBookmark).page === "number",
    );
  } catch {
    return [];
  }
}

export function saveBookmarks(
  fileName: string | null,
  numPages: number,
  list: SavedViewBookmark[],
): void {
  if (typeof window === "undefined" || !fileName || numPages < 1) return;
  try {
    const fp = fileFingerprint(fileName, numPages);
    localStorage.setItem(prefix(fp), JSON.stringify(list));
  } catch {
    /* quota */
  }
}

/** Full session backup (same shape as persisted session + meta). */
export type SessionBackupPayload = {
  version: 1;
  exportedAt: string;
  displayName?: string;
  session: {
    fingerprint: string;
    currentPage: number;
    scale: number;
    annotations: Annotation[];
    calibrationByPage: Record<string, Calibration>;
    measureUnit?: MeasureUnit;
    snapToGeometry?: boolean;
    snapRadiusPx?: number;
    takeoffItems?: TakeoffItem[];
    takeoffZones?: TakeoffZone[];
    takeoffPackageStatus?: TakeoffPackageStatus;
  };
  bookmarks?: SavedViewBookmark[];
};

export function buildSessionBackupJson(getState: {
  fileName: string | null;
  numPages: number;
  currentPage: number;
  scale: number;
  annotations: Annotation[];
  calibrationByPage: Record<number, Calibration>;
  measureUnit: MeasureUnit;
  snapToGeometry: boolean;
  snapRadiusPx: number;
  displayName: string;
  takeoffItems: TakeoffItem[];
  takeoffZones: TakeoffZone[];
  takeoffPackageStatus: TakeoffPackageStatus;
}): string {
  const fp = fileFingerprint(getState.fileName, getState.numPages);
  const bookmarks =
    getState.fileName && getState.numPages > 0
      ? loadBookmarks(getState.fileName, getState.numPages)
      : [];
  const payload: SessionBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    displayName: getState.displayName,
    session: {
      fingerprint: fp,
      currentPage: getState.currentPage,
      scale: getState.scale,
      annotations: getState.annotations,
      calibrationByPage: Object.fromEntries(
        Object.entries(getState.calibrationByPage).map(([k, v]) => [String(k), v]),
      ),
      measureUnit: getState.measureUnit,
      snapToGeometry: getState.snapToGeometry,
      snapRadiusPx: getState.snapRadiusPx,
      takeoffItems: getState.takeoffItems,
      takeoffZones: getState.takeoffZones,
      takeoffPackageStatus: getState.takeoffPackageStatus,
    },
    bookmarks,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseSessionBackupJson(raw: string): SessionBackupPayload | null {
  try {
    const data = JSON.parse(raw) as SessionBackupPayload;
    if (
      data?.version !== 1 ||
      !data.session?.fingerprint ||
      !Array.isArray(data.session.annotations)
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

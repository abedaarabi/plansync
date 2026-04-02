import type { MeasureUnit } from "@/lib/coords";
import type { TakeoffItem, TakeoffPackageStatus, TakeoffZone } from "@/lib/takeoffTypes";
import type { Annotation, Calibration } from "@/store/viewerStore";

/** Current session key (PlanSync). */
export const VIEWER_SESSION_STORAGE_KEY = "plansync-session-v1";

const LEGACY_SESSION_KEY = "cv-viewer-session-v1";

export function fileFingerprint(fileName: string | null, numPages: number): string {
  return `${fileName ?? ""}|${numPages}`;
}

const CAL_LAST_MM_PREFIX = "plansync-cal-last-known-mm";

export function calibrateLastKnownMmStorageKey(
  fileName: string | null,
  numPages: number,
  pageIndex0: number,
): string {
  return `${CAL_LAST_MM_PREFIX}:${fileFingerprint(fileName, numPages)}:${pageIndex0}`;
}

/** Last successful “known distance” (mm) entered for this page — pre-fills the calibration dialog. */
export function loadLastCalibrationKnownMm(
  fileName: string | null,
  numPages: number,
  pageIndex0: number,
): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(
      calibrateLastKnownMmStorageKey(fileName, numPages, pageIndex0),
    );
    if (raw == null) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveLastCalibrationKnownMm(
  fileName: string | null,
  numPages: number,
  pageIndex0: number,
  knownMm: number,
): void {
  if (typeof window === "undefined") return;
  try {
    if (Number.isFinite(knownMm) && knownMm > 0) {
      localStorage.setItem(
        calibrateLastKnownMmStorageKey(fileName, numPages, pageIndex0),
        String(knownMm),
      );
    }
  } catch {
    /* quota */
  }
}

export type PersistedPayload = {
  fingerprint: string;
  currentPage: number;
  scale: number;
  annotations: Annotation[];
  calibrationByPage: Record<string, Calibration>;
  /** Restored per document (file + page count fingerprint). */
  measureUnit?: MeasureUnit;
  snapToGeometry?: boolean;
  snapRadiusPx?: number;
  takeoffItems?: TakeoffItem[];
  takeoffZones?: TakeoffZone[];
  takeoffPackageStatus?: TakeoffPackageStatus;
};

function parseSession(raw: string | null): PersistedPayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PersistedPayload;
    if (!data?.fingerprint || !Array.isArray(data.annotations)) return null;
    return data;
  } catch {
    return null;
  }
}

export function loadPersistedSession(): PersistedPayload | null {
  if (typeof window === "undefined") return null;
  const next = parseSession(localStorage.getItem(VIEWER_SESSION_STORAGE_KEY));
  if (next) return next;
  const legacy = parseSession(localStorage.getItem(LEGACY_SESSION_KEY));
  if (legacy) {
    try {
      localStorage.setItem(VIEWER_SESSION_STORAGE_KEY, JSON.stringify(legacy));
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      /* ignore migration write */
    }
    return legacy;
  }
  return null;
}

export function savePersistedSession(payload: PersistedPayload) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEWER_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VIEWER_SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function calibrationFromPersisted(
  raw: Record<string, Calibration>,
): Record<number, Calibration> {
  const out: Record<number, Calibration> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[Number(k)] = v;
  }
  return out;
}

const DISPLAY_NAME_KEY = "plansync-display-name";
const LEGACY_DISPLAY_NAME_KEY = "construction-viewer-name";

/** Read display name (migrates legacy key once). */
export function loadDisplayNameFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const next = localStorage.getItem(DISPLAY_NAME_KEY);
    if (next != null && next !== "") return next;
    const legacy = localStorage.getItem(LEGACY_DISPLAY_NAME_KEY);
    if (legacy != null && legacy !== "") {
      localStorage.setItem(DISPLAY_NAME_KEY, legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveDisplayNameToStorage(name: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

/** Remove session JSON, display name, calibration guide flags, bookmarks, onboarding flags — PlanSync + legacy keys. */
export function clearAllViewerLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VIEWER_SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
    localStorage.removeItem(DISPLAY_NAME_KEY);
    localStorage.removeItem(LEGACY_DISPLAY_NAME_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("plansync-cal-guide-") ||
          k.startsWith("plansync-bookmarks-") ||
          k.startsWith("plansync-onboarding-") ||
          k.startsWith("cv-cal-guide-") ||
          k.startsWith("cv-bookmarks-") ||
          k.startsWith("cv-onboarding-"))
      ) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

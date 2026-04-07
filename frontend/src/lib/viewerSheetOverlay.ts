import type { Annotation } from "@/store/viewerStore";

/** What to draw on the sheet (and allow selecting) in the PDF viewer. */
export type SheetOverlayVisibility = {
  showMarkups: boolean;
  showMeasurements: boolean;
  showIssuePins: boolean;
  showAssetPins: boolean;
  showTakeoff: boolean;
};

export const DEFAULT_SHEET_OVERLAY_VISIBILITY: SheetOverlayVisibility = {
  showMarkups: true,
  showMeasurements: true,
  showIssuePins: true,
  showAssetPins: true,
  showTakeoff: true,
};

const LS_KEY = "plansync.viewer.sheetOverlay.v1";

export function persistSheetOverlayVisibility(v: SheetOverlayVisibility): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* ignore quota */
  }
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

/** Coerce parsed JSON / partial state into valid booleans. */
export function normalizeSheetOverlayVisibility(
  partial: Partial<Record<keyof SheetOverlayVisibility, unknown>> | null | undefined,
): SheetOverlayVisibility {
  const d = DEFAULT_SHEET_OVERLAY_VISIBILITY;
  return {
    showMarkups: asBool(partial?.showMarkups, d.showMarkups),
    showMeasurements: asBool(partial?.showMeasurements, d.showMeasurements),
    showIssuePins: asBool(partial?.showIssuePins, d.showIssuePins),
    showAssetPins: asBool(partial?.showAssetPins, d.showAssetPins),
    showTakeoff: asBool(partial?.showTakeoff, d.showTakeoff),
  };
}

function isAllLayersOff(v: SheetOverlayVisibility): boolean {
  return (
    !v.showMarkups && !v.showMeasurements && !v.showIssuePins && !v.showAssetPins && !v.showTakeoff
  );
}

export function loadSheetOverlayVisibilityFromStorage(): SheetOverlayVisibility | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<Record<keyof SheetOverlayVisibility, unknown>>;
    const v = normalizeSheetOverlayVisibility(j);
    /** Reloading with “everything hidden” left a blank sheet; default back to all on and fix storage. */
    if (isAllLayersOff(v)) {
      const next = { ...DEFAULT_SHEET_OVERLAY_VISIBILITY };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    }
    return v;
  } catch {
    return null;
  }
}

/** Whether a committed annotation should appear on the canvas for the current overlay flags. */
export function annotationPassesOverlayVisibility(
  a: Annotation,
  v: SheetOverlayVisibility,
): boolean {
  if (a.type === "measurement") return v.showMeasurements;
  if (a.linkedOmAssetId || a.omAssetDraft) return v.showAssetPins;
  if (a.linkedIssueId || a.issueDraft) return v.showIssuePins;
  return v.showMarkups;
}

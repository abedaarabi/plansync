import { annotationIsIssuePin } from "@/lib/annotationIssues";
import type { Annotation } from "@/store/viewerStore";

export type SheetExportInclude = {
  markups: boolean;
  measurements: boolean;
  issuePins: boolean;
  takeoff: boolean;
};

export const DEFAULT_SHEET_EXPORT_INCLUDE: SheetExportInclude = {
  markups: true,
  measurements: true,
  issuePins: true,
  takeoff: true,
};

const STORAGE_KEY = "plansync-sheet-export-include-v1";

export function loadSheetExportInclude(): SheetExportInclude {
  if (typeof window === "undefined") return { ...DEFAULT_SHEET_EXPORT_INCLUDE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHEET_EXPORT_INCLUDE };
    const o = JSON.parse(raw) as Partial<SheetExportInclude>;
    return {
      markups: typeof o.markups === "boolean" ? o.markups : true,
      measurements: typeof o.measurements === "boolean" ? o.measurements : true,
      issuePins: typeof o.issuePins === "boolean" ? o.issuePins : true,
      takeoff: typeof o.takeoff === "boolean" ? o.takeoff : true,
    };
  } catch {
    return { ...DEFAULT_SHEET_EXPORT_INCLUDE };
  }
}

export function saveSheetExportInclude(inc: SheetExportInclude) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inc));
  } catch {
    /* quota / private mode */
  }
}

/** Filters annotations for raster exports (PDF/PNG) by layer toggles. */
export function filterAnnotationsForExport(
  annotations: Annotation[],
  inc: SheetExportInclude,
): Annotation[] {
  return annotations.filter((a) => {
    const isMeas = a.type === "measurement";
    const isPin = annotationIsIssuePin(a);
    const isMarkup = !isMeas && !isPin;
    if (isMeas && !inc.measurements) return false;
    if (isPin && !inc.issuePins) return false;
    if (isMarkup && !inc.markups) return false;
    return true;
  });
}

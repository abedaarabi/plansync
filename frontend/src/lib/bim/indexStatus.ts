import type { BimLoqReport, BimQuantityIndex } from "@/lib/bim/types";

const ACTIVE_INDEX_STATUSES = new Set(["pending", "running", "summary_ready"]);

function metadataReady(index: BimQuantityIndex | null, loq: BimLoqReport | null): boolean {
  return Boolean(loq || (index && Object.keys(index.byType).length > 0));
}

/** Quantity index job is queued or actively building (summary or full pass). */
export function bimIndexBuilding(conversionStatus: string): boolean {
  return ACTIVE_INDEX_STATUSES.has(conversionStatus);
}

/** Short label for viewport / panel status chips. */
export function bimIndexStatusLabel(
  conversionStatus: string,
  indexPhase?: "summary" | "full" | null,
): string {
  if (conversionStatus === "summary_ready" || indexPhase === "full") {
    return "Enriching quantity index…";
  }
  if (conversionStatus === "running" || indexPhase === "summary") {
    return "Indexing model…";
  }
  if (conversionStatus === "pending") return "Index rebuild queued…";
  return "Building quantity index…";
}

/** Full property pass still running after summary metadata landed. */
export function bimIndexEnriching(
  conversionStatus: string,
  index: BimQuantityIndex | null,
  loq: BimLoqReport | null,
): boolean {
  return (
    conversionStatus !== "ready" &&
    metadataReady(index, loq) &&
    ACTIVE_INDEX_STATUSES.has(conversionStatus)
  );
}

/** Block UI with a spinner until chart/filter metadata exists. */
export function bimIndexBlockingLoad(
  conversionStatus: string,
  index: BimQuantityIndex | null,
  loq: BimLoqReport | null,
): boolean {
  return !metadataReady(index, loq) && ACTIVE_INDEX_STATUSES.has(conversionStatus);
}

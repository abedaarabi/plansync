import type { BimLoqReport, BimQuantityIndex } from "@/lib/bim/types";

const ACTIVE_INDEX_STATUSES = new Set(["pending", "running", "summary_ready"]);

function metadataReady(index: BimQuantityIndex | null, loq: BimLoqReport | null): boolean {
  return Boolean(loq || (index && Object.keys(index.byType).length > 0));
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

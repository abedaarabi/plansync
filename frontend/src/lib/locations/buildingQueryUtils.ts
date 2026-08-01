import type { ProcessingStatus } from "@/lib/api-client/locations";

export const BUILDING_POLL_MS = 3000;

function isProcessingStatus(status: ProcessingStatus): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

export function hasProcessingAssets(assets: { status: ProcessingStatus }[] | undefined): boolean {
  return assets?.some((a) => isProcessingStatus(a.status)) ?? false;
}

export function buildingAssetsFilterKey(filters: { type?: string; discipline?: string }): string {
  return `${filters.type ?? "ALL"}-${filters.discipline ?? "ALL"}`;
}

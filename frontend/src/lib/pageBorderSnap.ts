import type { SnapSegment } from "@/lib/pdfSnapGeometry";

/** Synthetic layer for the page crop box — always eligible for snap. */
export const PAGE_BORDER_LAYER_ID = "__page_border__";

/** Four edges in normalized [0,1]² so tools can snap to the sheet outline. */
export function createPageBorderSegments(): SnapSegment[] {
  return [
    { nx1: 0, ny1: 0, nx2: 1, ny2: 0, layerId: PAGE_BORDER_LAYER_ID, pathIndex: -1 },
    { nx1: 1, ny1: 0, nx2: 1, ny2: 1, layerId: PAGE_BORDER_LAYER_ID, pathIndex: -2 },
    { nx1: 1, ny1: 1, nx2: 0, ny2: 1, layerId: PAGE_BORDER_LAYER_ID, pathIndex: -3 },
    { nx1: 0, ny1: 1, nx2: 0, ny2: 0, layerId: PAGE_BORDER_LAYER_ID, pathIndex: -4 },
  ];
}

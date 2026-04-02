import { useViewerStore } from "@/store/viewerStore";

/** Snapshot sent with Sheet AI requests (page context). */
export function buildSheetAiViewerSnapshot(
  pageIndex0: number,
  state: ReturnType<typeof useViewerStore.getState>,
  issues?: { title: string; status: string }[],
): Record<string, unknown> {
  return {
    currentPage1Based: pageIndex0 + 1,
    fileName: state.fileName,
    pageCalibrated: Boolean(state.calibrationByPage[pageIndex0]),
    takeoffZonesOnPage: state.takeoffZones.filter((z) => z.pageIndex === pageIndex0).length,
    takeoffItemCount: state.takeoffItems.length,
    markupsOnPage: state.annotations.filter(
      (a) =>
        a.pageIndex === pageIndex0 && !a.linkedIssueId && !a.issueDraft && a.type !== "measurement",
    ).length,
    openIssuesOnSheet: issues ?? [],
  };
}

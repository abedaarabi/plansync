"use client";

import { useEffect } from "react";
import type { SheetOverlayVisibility } from "@/lib/viewerSheetOverlay";
import { useViewerStore } from "@/store/viewerStore";

/**
 * Turn on the sheet overlay layer(s) that match the active canvas tool and Pro flows
 * (issues, assets, takeoff) so markups/pins/zones are visible while you work.
 */
export function useSyncSheetOverlaysToViewerChrome() {
  const tool = useViewerStore((s) => s.tool);
  const takeoffMode = useViewerStore((s) => s.takeoffMode);
  const newIssuePlacementActive = useViewerStore((s) => s.newIssuePlacementActive);
  const issuePlacement = useViewerStore((s) => s.issuePlacement);
  const issueCreateDraft = useViewerStore((s) => s.issueCreateDraft);
  const issueFormSliderOpen = useViewerStore((s) => s.issueFormSliderOpen);
  const omAssetPlacementActive = useViewerStore((s) => s.omAssetPlacementActive);
  const omAssetCreateDraft = useViewerStore((s) => s.omAssetCreateDraft);

  useEffect(() => {
    const patch = useViewerStore.getState().patchSheetOverlayVisibility;
    const p: Partial<SheetOverlayVisibility> = {};
    if (tool === "takeoff" || takeoffMode) p.showTakeoff = true;
    if (tool === "measure" || tool === "calibrate") p.showMeasurements = true;
    if (tool === "annotate") p.showMarkups = true;
    if (tool === "select") {
      p.showMarkups = true;
      p.showMeasurements = true;
      p.showIssuePins = true;
      p.showAssetPins = true;
    }
    if (Object.keys(p).length > 0) patch(p);
  }, [tool, takeoffMode]);

  useEffect(() => {
    if (
      newIssuePlacementActive ||
      issuePlacement != null ||
      issueCreateDraft != null ||
      issueFormSliderOpen
    ) {
      useViewerStore.getState().patchSheetOverlayVisibility({ showIssuePins: true });
    }
  }, [newIssuePlacementActive, issuePlacement, issueCreateDraft, issueFormSliderOpen]);

  useEffect(() => {
    if (omAssetPlacementActive || omAssetCreateDraft != null) {
      useViewerStore.getState().patchSheetOverlayVisibility({ showAssetPins: true });
    }
  }, [omAssetPlacementActive, omAssetCreateDraft]);
}

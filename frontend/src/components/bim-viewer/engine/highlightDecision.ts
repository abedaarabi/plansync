import type { BimCameraMode, BimTool } from "./types";

export type FilterHighlightState = {
  hasFilterGhostMap: boolean;
  hasFilterMatchMap: boolean;
  filterSceneGhostOpacity: number | null;
  colorizeGroupCount: number;
};

export type SelectionHighlightState = {
  clashReviewSuppressSelectPaint: boolean;
  selectedGuidCount: number;
  hasLastPickMap: boolean;
  highlighterSelectHasIds: boolean;
};

/** Re-apply ghost / colorize tints after fragment material or tile updates. */
export function hasActiveFilterHighlights(state: FilterHighlightState): boolean {
  return (
    state.hasFilterGhostMap ||
    state.hasFilterMatchMap ||
    state.filterSceneGhostOpacity != null ||
    state.colorizeGroupCount > 0
  );
}

/**
 * Clash review keeps guids for inspect/UI but must not paint select tint.
 * Highlighter select maps count when guid/pick state is empty.
 */
export function hasActiveSelectionHighlight(state: SelectionHighlightState): boolean {
  if (state.clashReviewSuppressSelectPaint) return false;
  if (state.selectedGuidCount > 0 || state.hasLastPickMap) return true;
  return state.highlighterSelectHasIds;
}

/**
 * Prefer Outliner see-through + edge (BIM 360 / Forge OVERLAYED). Flat fragment
 * select tint flattens materials and looks muddy when stacked with the outline.
 */
export function shouldPaintFragmentSelectTint(opts: {
  clashReviewSuppressSelectPaint: boolean;
  postproductionOutlinesActive: boolean;
}): boolean {
  if (opts.clashReviewSuppressSelectPaint) return false;
  if (opts.postproductionOutlinesActive) return false;
  return true;
}

/**
 * Outline-only selection does not need fragment tints — keep materials live
 * under the Outliner wash instead of deferring sync.
 */
export function hasActiveFragmentHighlights(opts: {
  filter: FilterHighlightState;
  selection: SelectionHighlightState;
  postproductionOutlinesActive: boolean;
}): boolean {
  const selectTint =
    hasActiveSelectionHighlight(opts.selection) &&
    shouldPaintFragmentSelectTint({
      clashReviewSuppressSelectPaint: opts.selection.clashReviewSuppressSelectPaint,
      postproductionOutlinesActive: opts.postproductionOutlinesActive,
    });
  return hasActiveFilterHighlights(opts.filter) || selectTint;
}

export function shouldDeferMaterialSync(opts: {
  hasFragmentHighlights: boolean;
  clashSceneGhostOpacity: number | null;
  filterSceneGhostOpacity: number | null;
}): boolean {
  return (
    opts.hasFragmentHighlights ||
    opts.clashSceneGhostOpacity != null ||
    opts.filterSceneGhostOpacity != null
  );
}

/** Hover preview is only useful in orbit select mode — not over look-only ghosts. */
export function shouldEnableHover(opts: {
  tool: BimTool;
  cameraMode: BimCameraMode;
  clashGhostPickOnly: boolean;
  hasFilterGhostMap: boolean;
  filterSceneGhostOpacity: number | null;
}): boolean {
  const ghostLookOnly =
    opts.clashGhostPickOnly || opts.hasFilterGhostMap || opts.filterSceneGhostOpacity != null;
  return opts.tool === "select" && opts.cameraMode !== "walk" && !ghostLookOnly;
}

export function hasClashPairColors(groups: ReadonlyArray<{ styleId: string }>): boolean {
  return groups.some((g) => g.styleId === "clash-item-1" || g.styleId === "clash-item-2");
}

/** True when both Item 1 (green) and Item 2 (red) are painted. */
export function hasBothClashPartnerColors(groups: ReadonlyArray<{ styleId: string }>): boolean {
  let item1 = false;
  let item2 = false;
  for (const g of groups) {
    if (g.styleId === "clash-item-1") item1 = true;
    if (g.styleId === "clash-item-2") item2 = true;
  }
  return item1 && item2;
}

import { describe, expect, it } from "vitest";
import {
  hasActiveFilterHighlights,
  hasActiveFragmentHighlights,
  hasActiveSelectionHighlight,
  hasClashPairColors,
  shouldDeferMaterialSync,
  shouldEnableHover,
  shouldPaintFragmentSelectTint,
  type FilterHighlightState,
  type SelectionHighlightState,
} from "./highlightDecision";

const idleFilter: FilterHighlightState = {
  hasFilterGhostMap: false,
  hasFilterMatchMap: false,
  filterSceneGhostOpacity: null,
  colorizeGroupCount: 0,
};

const idleSelection: SelectionHighlightState = {
  clashReviewSuppressSelectPaint: false,
  selectedGuidCount: 0,
  hasLastPickMap: false,
  highlighterSelectHasIds: false,
};

describe("hasActiveFilterHighlights", () => {
  it("is false when nothing is active", () => {
    expect(hasActiveFilterHighlights(idleFilter)).toBe(false);
  });

  it("is true for ghost map, match map, scene opacity, or colorize groups", () => {
    expect(hasActiveFilterHighlights({ ...idleFilter, hasFilterGhostMap: true })).toBe(true);
    expect(hasActiveFilterHighlights({ ...idleFilter, hasFilterMatchMap: true })).toBe(true);
    expect(hasActiveFilterHighlights({ ...idleFilter, filterSceneGhostOpacity: 0.2 })).toBe(true);
    expect(hasActiveFilterHighlights({ ...idleFilter, colorizeGroupCount: 2 })).toBe(true);
  });
});

describe("hasActiveSelectionHighlight", () => {
  it("suppresses paint during clash review even with guids", () => {
    expect(
      hasActiveSelectionHighlight({
        ...idleSelection,
        clashReviewSuppressSelectPaint: true,
        selectedGuidCount: 3,
      }),
    ).toBe(false);
  });

  it("detects guids, last pick, or highlighter select maps", () => {
    expect(hasActiveSelectionHighlight({ ...idleSelection, selectedGuidCount: 1 })).toBe(true);
    expect(hasActiveSelectionHighlight({ ...idleSelection, hasLastPickMap: true })).toBe(true);
    expect(hasActiveSelectionHighlight({ ...idleSelection, highlighterSelectHasIds: true })).toBe(
      true,
    );
  });
});

describe("shouldPaintFragmentSelectTint", () => {
  it("skips tint when clash review or outliner is active", () => {
    expect(
      shouldPaintFragmentSelectTint({
        clashReviewSuppressSelectPaint: true,
        postproductionOutlinesActive: false,
      }),
    ).toBe(false);
    expect(
      shouldPaintFragmentSelectTint({
        clashReviewSuppressSelectPaint: false,
        postproductionOutlinesActive: true,
      }),
    ).toBe(false);
  });

  it("allows tint when neither clash review nor outliner is active", () => {
    expect(
      shouldPaintFragmentSelectTint({
        clashReviewSuppressSelectPaint: false,
        postproductionOutlinesActive: false,
      }),
    ).toBe(true);
  });
});

describe("hasActiveFragmentHighlights", () => {
  it("treats outline-only selection as inactive for fragment tints", () => {
    expect(
      hasActiveFragmentHighlights({
        filter: idleFilter,
        selection: { ...idleSelection, selectedGuidCount: 1 },
        postproductionOutlinesActive: true,
      }),
    ).toBe(false);
  });

  it("is true for filter overlays or select tint paint", () => {
    expect(
      hasActiveFragmentHighlights({
        filter: { ...idleFilter, colorizeGroupCount: 1 },
        selection: idleSelection,
        postproductionOutlinesActive: true,
      }),
    ).toBe(true);
    expect(
      hasActiveFragmentHighlights({
        filter: idleFilter,
        selection: { ...idleSelection, selectedGuidCount: 1 },
        postproductionOutlinesActive: false,
      }),
    ).toBe(true);
  });
});

describe("shouldDeferMaterialSync", () => {
  it("defers while fragment highlights or scene ghosts are active", () => {
    expect(
      shouldDeferMaterialSync({
        hasFragmentHighlights: false,
        clashSceneGhostOpacity: null,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(false);
    expect(
      shouldDeferMaterialSync({
        hasFragmentHighlights: true,
        clashSceneGhostOpacity: null,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(true);
    expect(
      shouldDeferMaterialSync({
        hasFragmentHighlights: false,
        clashSceneGhostOpacity: 0.15,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(true);
    expect(
      shouldDeferMaterialSync({
        hasFragmentHighlights: false,
        clashSceneGhostOpacity: null,
        filterSceneGhostOpacity: 0.18,
      }),
    ).toBe(true);
  });
});

describe("shouldEnableHover", () => {
  it("enables only in orbit select without look-only ghosts", () => {
    expect(
      shouldEnableHover({
        tool: "select",
        cameraMode: "orbit",
        clashGhostPickOnly: false,
        hasFilterGhostMap: false,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(true);
  });

  it("disables in walk, non-select tools, or ghost look-only modes", () => {
    expect(
      shouldEnableHover({
        tool: "select",
        cameraMode: "walk",
        clashGhostPickOnly: false,
        hasFilterGhostMap: false,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(false);
    expect(
      shouldEnableHover({
        tool: "clip",
        cameraMode: "orbit",
        clashGhostPickOnly: false,
        hasFilterGhostMap: false,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(false);
    expect(
      shouldEnableHover({
        tool: "select",
        cameraMode: "orbit",
        clashGhostPickOnly: true,
        hasFilterGhostMap: false,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(false);
    expect(
      shouldEnableHover({
        tool: "select",
        cameraMode: "orbit",
        clashGhostPickOnly: false,
        hasFilterGhostMap: true,
        filterSceneGhostOpacity: null,
      }),
    ).toBe(false);
  });
});

describe("hasClashPairColors", () => {
  it("detects clash item style ids only", () => {
    expect(hasClashPairColors([{ styleId: "filter:match" }])).toBe(false);
    expect(hasClashPairColors([{ styleId: "clash-item-1" }])).toBe(true);
    expect(hasClashPairColors([{ styleId: "clash-item-2" }])).toBe(true);
  });
});

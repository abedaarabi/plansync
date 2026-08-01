"use client";

import {
  BarChart3,
  Camera,
  Crosshair,
  DraftingCompass,
  Eraser,
  Expand,
  Keyboard,
  Layers,
  LayoutGrid,
  Map,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  PersonStanding,
  Ruler,
  Scan,
  Scissors,
  Search,
  TriangleRight,
} from "lucide-react";
import type { BimCameraMode, BimTool } from "./bimEngine";
import type { BimQuantityIndex } from "@/lib/bim/types";
import type { BimWalkPlanSize } from "@/lib/bim/walkPlanSize";
import { BimElementSearchPanel } from "./BimElementSearchPanel";
import { BimAnalyticsDrawer } from "./BimAnalyticsDrawer";
import { BimMarkupFlyoutPanel } from "./BimMarkupFlyoutPanel";
import type { BimChartSegment } from "@/lib/bim/chartStats";
import type { BimMarkupMode } from "@/store/bimMarkupStore";
import type { MarkupShape } from "@/store/viewerStore";

export type BimBottomFlyout =
  | "measure"
  | "navigate"
  | "more"
  | "search"
  | "markup"
  | "analytics"
  | null;

// fallow-ignore-next-line complexity
export function BimBottomToolBar(props: {
  tool: BimTool;
  cameraMode: BimCameraMode;
  activeFlyout: BimBottomFlyout;
  fullscreen: boolean;
  toolHint: string | null;
  showPlacePoint: boolean;
  quantityIndex: BimQuantityIndex | null;
  conversionStatus: string;
  selectedGuids: Set<string>;
  onSelectTool: (tool: BimTool) => void;
  onSelectCameraMode: (mode: BimCameraMode) => void;
  onToggleFlyout: (flyout: Exclude<BimBottomFlyout, null>) => void;
  onFitToView: () => void;
  onShowAll: () => void;
  onToggleProjection: () => void;
  onClearMarkups: () => void;
  onSnapshot: () => void;
  onToggleFullscreen: () => void;
  onPlacePoint: () => void;
  walkPlanSize: BimWalkPlanSize;
  onToggleWalkPlan: () => void;
  clusterByType: boolean;
  onToggleClusterByType: () => void;
  onSelectElement: (guid: string) => void;
  onSelectChartSegment: (segment: BimChartSegment) => void;
  onCloseSearch: () => void;
  onCloseAnalytics: () => void;
  markupShape: MarkupShape;
  markupMode: BimMarkupMode;
  strokeColor: string;
  strokeWidth: number;
  markupSelectionCount: number;
  onSetMarkupShape: (shape: MarkupShape) => void;
  onSetMarkupMode: (mode: BimMarkupMode) => void;
  onSetStrokeColor: (color: string) => void;
  onSetStrokeWidth: (width: number) => void;
  onDeleteSelectedMarkups: () => void;
  onCreateIssueFromMarkup: () => void;
  onOpenShortcuts: () => void;
}) {
  const measureActive = props.tool === "length" || props.tool === "area" || props.tool === "angle";
  return (
    <div className="bim-bottom-bar-wrap">
      {props.activeFlyout === "search" ? (
        <BimElementSearchPanel
          index={props.quantityIndex}
          selectedGuids={props.selectedGuids}
          onSelect={props.onSelectElement}
          onClose={props.onCloseSearch}
        />
      ) : null}

      {props.activeFlyout === "analytics" ? (
        <BimAnalyticsDrawer
          index={props.quantityIndex}
          selectedGuids={props.selectedGuids}
          conversionStatus={props.conversionStatus}
          onSelectSegment={props.onSelectChartSegment}
          onClose={props.onCloseAnalytics}
        />
      ) : null}

      {props.toolHint &&
      props.activeFlyout !== "search" &&
      props.activeFlyout !== "markup" &&
      props.activeFlyout !== "analytics" ? (
        <p className="bim-tool-hint-pill bim-glass-surface">{props.toolHint}</p>
      ) : null}

      {props.activeFlyout === "markup" ? (
        <div className="bim-markup-flyout-wrap bim-glass-surface">
          <BimMarkupFlyoutPanel
            markupShape={props.markupShape}
            markupMode={props.markupMode}
            strokeColor={props.strokeColor}
            strokeWidth={props.strokeWidth}
            hasSelection={props.markupSelectionCount > 0}
            onSetShape={props.onSetMarkupShape}
            onSetMode={props.onSetMarkupMode}
            onSetColor={props.onSetStrokeColor}
            onSetWidth={props.onSetStrokeWidth}
            onDeleteSelected={props.onDeleteSelectedMarkups}
            onCreateIssue={props.onCreateIssueFromMarkup}
          />
        </div>
      ) : null}

      <div
        className="bim-bottom-bar bim-glass-surface bim-bottom-bar-scroll"
        role="toolbar"
        aria-label="Model tools"
      >
        <button
          type="button"
          aria-label="Search elements"
          aria-expanded={props.activeFlyout === "search"}
          title="Search elements"
          data-active={props.activeFlyout === "search"}
          onClick={() => props.onToggleFlyout("search")}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <button
          type="button"
          aria-label="Model analytics"
          aria-expanded={props.activeFlyout === "analytics"}
          title="Charts & quantities"
          data-active={props.activeFlyout === "analytics"}
          onClick={() => props.onToggleFlyout("analytics")}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <BarChart3 className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <div className="bim-bottom-bar-divider" aria-hidden />

        <button
          type="button"
          aria-label="Select"
          title="Select"
          data-active={props.tool === "select"}
          onClick={() => props.onSelectTool("select")}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <MousePointer2 className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <div className="flex items-center">
          <button
            type="button"
            aria-label="Measure tools"
            aria-expanded={props.activeFlyout === "measure"}
            title="Measure"
            data-active={measureActive}
            data-expanded={props.activeFlyout === "measure"}
            onClick={() => props.onToggleFlyout("measure")}
            className="bim-bottom-bar-btn mobile-touch-target"
          >
            <Ruler className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <div className="bim-bottom-flyout" data-open={props.activeFlyout === "measure"}>
            <FlyoutBtn
              label="Length"
              active={props.tool === "length"}
              onClick={() => props.onSelectTool("length")}
              icon={Ruler}
            />
            <FlyoutBtn
              label="Area"
              active={props.tool === "area"}
              onClick={() => props.onSelectTool("area")}
              icon={DraftingCompass}
            />
            <FlyoutBtn
              label="Angle"
              active={props.tool === "angle"}
              onClick={() => props.onSelectTool("angle")}
              icon={TriangleRight}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label="Section"
          title={
            props.selectedGuids.size > 0
              ? `Section box on ${props.selectedGuids.size} selected`
              : "Section box (full model)"
          }
          data-active={props.tool === "clip"}
          onClick={() => props.onSelectTool("clip")}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <Scissors className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <div className="flex items-center">
          <button
            type="button"
            aria-label="Markup tools"
            aria-expanded={props.activeFlyout === "markup"}
            title="Markup"
            data-active={props.tool === "markup"}
            data-expanded={props.activeFlyout === "markup"}
            onClick={() => props.onSelectTool("markup")}
            className="bim-bottom-bar-btn mobile-touch-target"
          >
            <Pencil className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>

        <div className="bim-bottom-bar-divider" aria-hidden />

        <button
          type="button"
          aria-label={props.clusterByType ? "Restore model layout" : "Cluster by type"}
          title={
            props.clusterByType
              ? "Cluster by type · on — click to restore"
              : "Cluster by type — group elements like Autodesk Viewer"
          }
          data-active={props.clusterByType}
          onClick={props.onToggleClusterByType}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <LayoutGrid className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <button
          type="button"
          aria-label={props.cameraMode === "walk" ? "Switch to orbit camera" : "Walk mode"}
          title={props.cameraMode === "walk" ? "Orbit" : "Walk"}
          data-active={props.cameraMode === "walk"}
          onClick={() => props.onSelectCameraMode(props.cameraMode === "walk" ? "orbit" : "walk")}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <PersonStanding className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <div className="flex items-center">
          <button
            type="button"
            aria-label="Navigation"
            aria-expanded={props.activeFlyout === "navigate"}
            title="Navigate"
            data-active={props.activeFlyout === "navigate"}
            data-expanded={props.activeFlyout === "navigate"}
            onClick={() => props.onToggleFlyout("navigate")}
            className="bim-bottom-bar-btn mobile-touch-target"
          >
            <Scan className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <div className="bim-bottom-flyout" data-open={props.activeFlyout === "navigate"}>
            <FlyoutBtn
              label="Orbit"
              active={props.cameraMode === "orbit"}
              onClick={() => props.onSelectCameraMode("orbit")}
              icon={Scan}
            />
            <FlyoutBtn
              label="Walk"
              active={props.cameraMode === "walk"}
              onClick={() => props.onSelectCameraMode("walk")}
              icon={PersonStanding}
            />
            <FlyoutBtn label="Fit" active={false} onClick={props.onFitToView} icon={Maximize2} />
            <FlyoutBtn label="Show all" active={false} onClick={props.onShowAll} icon={Layers} />
          </div>
        </div>

        {props.cameraMode === "walk" ? (
          <button
            type="button"
            aria-label={props.walkPlanSize === "off" ? "Show 2D plan" : "Hide 2D plan"}
            title={props.walkPlanSize === "off" ? "Show 2D plan" : "Hide 2D plan"}
            data-active={props.walkPlanSize !== "off"}
            onClick={props.onToggleWalkPlan}
            className="bim-bottom-bar-btn mobile-touch-target"
          >
            <Map className="h-[18px] w-[18px]" aria-hidden />
          </button>
        ) : null}

        <div className="flex items-center">
          <button
            type="button"
            aria-label="More options"
            aria-expanded={props.activeFlyout === "more"}
            title="More"
            data-expanded={props.activeFlyout === "more"}
            onClick={() => props.onToggleFlyout("more")}
            className="bim-bottom-bar-btn mobile-touch-target"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <div className="bim-bottom-flyout" data-open={props.activeFlyout === "more"}>
            <FlyoutBtn
              label="Ortho"
              active={false}
              onClick={props.onToggleProjection}
              icon={Crosshair}
            />
            <FlyoutBtn label="Clear" active={false} onClick={props.onClearMarkups} icon={Eraser} />
            <FlyoutBtn label="Snapshot" active={false} onClick={props.onSnapshot} icon={Camera} />
            <FlyoutBtn
              label={props.fullscreen ? "Exit FS" : "Fullscreen"}
              active={props.fullscreen}
              onClick={props.onToggleFullscreen}
              icon={props.fullscreen ? Expand : Maximize2}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={props.onOpenShortcuts}
          className="bim-bottom-bar-btn mobile-touch-target"
        >
          <Keyboard className="h-[18px] w-[18px]" aria-hidden />
        </button>

        {props.showPlacePoint ? (
          <>
            <div className="bim-bottom-bar-divider" aria-hidden />
            <button
              type="button"
              onClick={props.onPlacePoint}
              className="bim-bottom-flyout-btn rounded-xl bg-[var(--bim-accent)] px-3 text-white"
            >
              Place point
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FlyoutBtn(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: typeof Ruler;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      aria-label={props.label}
      data-active={props.active}
      onClick={props.onClick}
      className="bim-bottom-flyout-btn"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {props.label}
    </button>
  );
}

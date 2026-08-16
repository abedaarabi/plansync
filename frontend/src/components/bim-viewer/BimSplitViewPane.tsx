"use client";

import { ChevronDown, Layers3, Map } from "lucide-react";
import type { BimEngine } from "./bimEngine";
import type { BimSyncContext, DrawingMapRecord } from "@/lib/api-client/bim-publish";
import type { DrawingCoordTransform } from "@/lib/bim/drawingCoordBridge";
import type { BimWalkPlanSize } from "@/lib/bim/walkPlanSize";
import { BimDrawingSyncPanel } from "./BimDrawingSyncPanel";
import { BimPlanMinimap } from "./BimPlanMinimap";
import { BimWalkPlanSizeControl } from "./BimWalkPlanSizeControl";

export type BimPlanPanelMode = "minimap" | "drawingSync";

export type PlanStoreyOption = { value: string; label: string };

// fallow-ignore-next-line complexity
export function BimSplitViewPane(props: {
  planPanelMode: BimPlanPanelMode;
  onPlanPanelModeChange: (mode: BimPlanPanelMode) => void;
  canDrawingSync: boolean;
  engine: BimEngine | null;
  storeys: string[];
  storeyOptions: PlanStoreyOption[];
  planMinimapStorey: string | null;
  onSelectStorey: (name: string | null) => void;
  syncContext: BimSyncContext | null;
  activeLevelMap: DrawingMapRecord | null;
  drawingTransform: DrawingCoordTransform | null;
  onAlign: () => void;
  hasDrawingMaps: boolean;
  walkPlanSize: BimWalkPlanSize;
  onWalkPlanSizeChange: (size: BimWalkPlanSize) => void;
}) {
  const transform = props.drawingTransform;

  return (
    <aside className="bim-split-pane" aria-label="2D plan and drawing view">
      <div className="bim-split-pane__toolbar">
        <span className="bim-split-pane__label">2D</span>
        <BimWalkPlanSizeControl size={props.walkPlanSize} onChange={props.onWalkPlanSizeChange} />
        {props.storeyOptions.length > 0 ? (
          <div className="bim-split-pane__floor-wrap">
            <select
              className="bim-split-pane__floor bim-focus-ring"
              aria-label="Floor level"
              value={props.planMinimapStorey ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                props.onSelectStorey(value === "" ? null : value);
              }}
            >
              <option value="">All levels</option>
              {props.storeyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="bim-split-pane__floor-icon" aria-hidden />
          </div>
        ) : null}
        <div className="flex rounded-full border border-[var(--bim-border)] bg-[var(--bim-surface)]/95 p-0.5 text-[10px]">
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 font-medium transition ${props.planPanelMode === "minimap" ? "bg-[var(--bim-accent-muted)] text-[var(--bim-accent)] ring-1 ring-[var(--bim-accent)]/45" : "text-[var(--bim-text-muted)]"}`}
            onClick={() => props.onPlanPanelModeChange("minimap")}
          >
            Plan
          </button>
          <button
            type="button"
            disabled={!props.canDrawingSync}
            title={
              props.canDrawingSync
                ? "Synced PDF navigation"
                : "Register or align a mapped sheet first"
            }
            className={`rounded-full px-2.5 py-1 font-medium transition disabled:opacity-40 ${props.planPanelMode === "drawingSync" ? "bg-[var(--bim-accent-muted)] text-[var(--bim-accent)] ring-1 ring-[var(--bim-accent)]/45" : "text-[var(--bim-text-muted)]"}`}
            onClick={() => props.onPlanPanelModeChange("drawingSync")}
          >
            Drawing
          </button>
        </div>
        {props.hasDrawingMaps ? (
          <button
            type="button"
            className="bim-glass-surface ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-[var(--bim-text)]"
            onClick={props.onAlign}
          >
            <Layers3 className="h-3 w-3" aria-hidden />
            Align
          </button>
        ) : null}
      </div>
      <div className="bim-split-pane__body">
        {props.planPanelMode === "drawingSync" && props.syncContext && transform ? (
          <BimDrawingSyncPanel
            engine={props.engine}
            syncContext={props.syncContext}
            transform={transform}
            className="h-full min-h-0 rounded-none border-0 shadow-none"
          />
        ) : props.planPanelMode === "drawingSync" ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--bim-text-muted)]">
            {props.canDrawingSync
              ? "Loading drawing sync for this level…"
              : "Register a drawing to this level, or align a mapped sheet, to enable drawing sync."}
          </div>
        ) : (
          <BimPlanMinimap
            variant="split"
            engine={props.engine}
            storeys={props.storeys}
            storeyOptions={props.storeyOptions}
            selectedStorey={props.planMinimapStorey}
            onSelectStorey={props.onSelectStorey}
          />
        )}
      </div>
      {props.planPanelMode === "minimap" ? (
        <p className="bim-split-pane__hint">
          <Map className="mr-1 inline h-3 w-3" aria-hidden />
          Drag the blue dot to move · outer beam to rotate · tap plan to jump
        </p>
      ) : props.planPanelMode === "drawingSync" && props.canDrawingSync ? (
        <p className="bim-split-pane__hint">
          <Map className="mr-1 inline h-3 w-3" aria-hidden />
          Drag the blue dot to move · outer beam to rotate · tap sheet to jump
        </p>
      ) : null}
    </aside>
  );
}

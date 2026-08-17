"use client";

import { ChevronDown, Layers3, Map } from "lucide-react";
import type { BimEngine } from "./bimEngine";
import type { BimSyncContext, DrawingMapRecord } from "@/lib/api-client/bim-publish";
import type { DrawingCoordTransform } from "@/lib/bim/drawingCoordBridge";
import { BimDrawingSyncPanel, type PdfFootprintHighlight } from "./BimDrawingSyncPanel";

export type PlanStoreyOption = { value: string; label: string };

export function BimSplitViewPane(props: {
  canDrawingSync: boolean;
  engine: BimEngine | null;
  storeyOptions: PlanStoreyOption[];
  planMinimapStorey: string | null;
  onSelectStorey: (name: string | null) => void;
  syncContext: BimSyncContext | null;
  activeLevelMap: DrawingMapRecord | null;
  drawingTransform: DrawingCoordTransform | null;
  onAlign: () => void;
  hasDrawingMaps: boolean;
  emptyTitle: string;
  emptyBody: string;
  onEmptyCta?: () => void;
  emptyCtaLabel?: string;
  highlight?: PdfFootprintHighlight | null;
}) {
  const transform = props.drawingTransform;
  const showDrawing = Boolean(props.canDrawingSync && props.syncContext && transform);

  return (
    <aside className="bim-split-pane" aria-label="Mapped PDF drawing">
      <div className="bim-split-pane__toolbar">
        <span className="bim-split-pane__label">PDF</span>
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
        {props.hasDrawingMaps ? (
          <button
            type="button"
            className="bim-glass-surface ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--bim-text)]"
            onClick={props.onAlign}
          >
            <Layers3 className="h-3 w-3" aria-hidden />
            Align
          </button>
        ) : null}
      </div>
      <div className="bim-split-pane__body">
        {showDrawing && props.syncContext && transform ? (
          <BimDrawingSyncPanel
            engine={props.engine}
            syncContext={props.syncContext}
            transform={transform}
            highlight={props.highlight}
            className="h-full min-h-0 rounded-none border-0 shadow-none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-sm font-medium text-[var(--bim-text)]">{props.emptyTitle}</p>
            <p className="max-w-xs text-xs text-[var(--bim-text-muted)]">{props.emptyBody}</p>
            {props.onEmptyCta && props.emptyCtaLabel ? (
              <button
                type="button"
                className="mt-1 rounded-md bg-[var(--bim-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={props.onEmptyCta}
              >
                {props.emptyCtaLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {showDrawing ? (
        <p className="bim-split-pane__hint">
          <Map className="mr-1 inline h-3 w-3" aria-hidden />
          Drag the blue dot to move · outer beam to rotate · tap sheet to jump
        </p>
      ) : null}
    </aside>
  );
}

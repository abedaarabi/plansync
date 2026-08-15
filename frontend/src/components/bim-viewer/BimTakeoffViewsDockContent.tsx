"use client";

import { useState } from "react";
import type { BimSavedViewRecord } from "@/lib/bim/types";
import type { BimModelQuantityRollup } from "@/lib/bim/modelQuantity";
import type { BimAnnotation } from "@/store/bimMarkupStore";
import { BimTakeoffPanel } from "./BimTakeoffPanel";
import { BimSavedViewsPanel } from "./BimSavedViewsPanel";
import { BimComparePanel } from "./BimComparePanel";
import { BimMarkupsPanel } from "./BimMarkupsPanel";
import type { BimEngine } from "./bimEngine";
import type { BimTakeoffSelectionSummary } from "./BimAddToTakeoffDialog";

export type BimTakeoffViewsTab = "takeoff" | "views";

// fallow-ignore-next-line complexity
export function BimTakeoffViewsDockContent(props: {
  fileVersionId: string | null;
  projectId: string | null;
  selectedGuids: string[];
  takeoffSelectionSummary: BimTakeoffSelectionSummary | null;
  resolveModelQuantities: () => Promise<BimModelQuantityRollup>;
  savedViews: BimSavedViewRecord[];
  onSaveView: () => void;
  onApplyView: (view: BimSavedViewRecord) => void;
  onDeleteView: (id: string) => void;
  compareDeltas: {
    baseVersion: number;
    compareVersion: number;
    deltas: {
      ifcType: string;
      countDelta: number;
      areaDelta: number | null;
      volumeDelta: number | null;
    }[];
  } | null;
  initialTab?: BimTakeoffViewsTab;
  markupAnnotations?: BimAnnotation[];
  markupSelectedIds?: string[];
  markupEngine?: BimEngine | null;
  onSelectMarkup?: (id: string) => void;
}) {
  const [tab, setTab] = useState<BimTakeoffViewsTab>(props.initialTab ?? "takeoff");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--bim-border)] px-3 py-2.5">
        <div className="bim-segment bim-segment-compact">
          <SegmentBtn
            active={tab === "takeoff"}
            label="Takeoff"
            badge={props.selectedGuids.length > 0 ? props.selectedGuids.length : undefined}
            onClick={() => setTab("takeoff")}
          />
          <SegmentBtn active={tab === "views"} label="Views" onClick={() => setTab("views")} />
        </div>
      </div>

      <div className="bim-dock-scroll">
        {tab === "takeoff" ? (
          <div className="p-4">
            <BimTakeoffPanel
              fileVersionId={props.fileVersionId}
              projectId={props.projectId}
              selectedGuids={props.selectedGuids}
              selectionSummary={props.takeoffSelectionSummary}
              resolveModelQuantities={props.resolveModelQuantities}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <BimSavedViewsPanel
              views={props.savedViews}
              onSave={props.onSaveView}
              onApply={props.onApplyView}
              onDelete={props.onDeleteView}
            />
            {props.compareDeltas ? (
              <BimComparePanel
                baseVersion={props.compareDeltas.baseVersion}
                compareVersion={props.compareDeltas.compareVersion}
                deltas={props.compareDeltas.deltas}
                projectId={props.projectId}
              />
            ) : null}
            <div className="bim-detail-card">
              <p className="bim-section-title">Markups</p>
              <p className="mb-3 text-[11px] text-[var(--bim-text-muted)]">
                Saved view markups for this model revision.
              </p>
              <BimMarkupsPanel
                engine={props.markupEngine ?? null}
                annotations={props.markupAnnotations ?? []}
                selectedIds={props.markupSelectedIds ?? []}
                onSelect={(id) => props.onSelectMarkup?.(id)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SegmentBtn(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      data-active={props.active}
      className="bim-segment-btn inline-flex items-center justify-center gap-1"
    >
      {props.label}
      {props.badge != null && props.badge > 0 ? (
        <span className="rounded-full bg-[var(--bim-accent-muted)] px-1.5 py-px text-[9px] font-bold tabular-nums text-[var(--bim-accent)]">
          {props.badge}
        </span>
      ) : null}
    </button>
  );
}

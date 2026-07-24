"use client";

import { useEffect, useState } from "react";
import type { BimQuantityEntry, BimQuantityIndex } from "@/lib/bim/types";
import type { IssueBimAnchor } from "@/lib/api-client/core-issues-takeoff";
import type { BimSelection } from "./bimEngine";
import { BimPropertiesPanel } from "./BimPropertiesPanel";
import { BimQuantitiesPanel } from "./BimQuantitiesPanel";

export type BimInspectTab = "properties" | "quantities";

// fallow-ignore-next-line complexity
export function BimInspectDockContent(props: {
  selection: BimSelection | null;
  selectionCount: number;
  quantityIndex: BimQuantityIndex | null;
  fileId: string;
  fileVersionId: string | null;
  projectId: string | null;
  onClearSelection: () => void;
  quantityRollup: {
    entries: BimQuantityEntry[];
    count: number;
    length: number | null;
    area: number | null;
    volume: number | null;
  };
  takeoffSelectionSummary: {
    elementCount: number;
    ifcTypes: string[];
    sampleName: string | null;
  } | null;
  initialTab?: BimInspectTab;
  onStartCreateIssue?: (anchor: IssueBimAnchor) => void;
  onAddFilterRule?: (group: string, property: string, value: string) => void;
}) {
  const [tab, setTab] = useState<BimInspectTab>(props.initialTab ?? "properties");

  useEffect(() => {
    if (props.initialTab) setTab(props.initialTab);
  }, [props.initialTab]);

  if (!props.selection && props.selectionCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 px-5 py-10 text-center">
        <p className="text-[12px] font-medium text-[var(--bim-text)]">Nothing selected</p>
        <p className="max-w-[14rem] text-[10px] leading-relaxed text-[var(--bim-text-muted)]">
          Select an element, then choose Show properties.
        </p>
      </div>
    );
  }

  return (
    <>
      {props.selection ? (
        <div className="bim-dock-selection">
          <p className="bim-dock-selection__name">{props.selection.name ?? "Unnamed element"}</p>
          <p className="bim-dock-selection__meta">
            {[props.selection.ifcType ?? "IFC element", props.selection.storey]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="border-b border-[var(--bim-border)] px-2.5 py-1.5">
        <div className="bim-segment bim-segment-compact">
          <SegmentBtn
            active={tab === "properties"}
            label="Properties"
            onClick={() => setTab("properties")}
          />
          <SegmentBtn
            active={tab === "quantities"}
            label="Quantities"
            onClick={() => setTab("quantities")}
          />
        </div>
      </div>

      {tab === "properties" ? (
        <BimPropertiesPanel
          selection={props.selection}
          quantityIndex={props.quantityIndex}
          fileId={props.fileId}
          fileVersionId={props.fileVersionId}
          projectId={props.projectId}
          variant="tab-content"
          onClose={props.onClearSelection}
          onStartCreateIssue={props.onStartCreateIssue}
          onAddFilterRule={props.onAddFilterRule}
        />
      ) : (
        <div className="p-2.5">
          <BimQuantitiesPanel
            entries={props.quantityRollup.entries}
            count={props.quantityRollup.count}
            length={props.quantityRollup.length}
            area={props.quantityRollup.area}
            volume={props.quantityRollup.volume}
            selectionSummary={props.takeoffSelectionSummary}
          />
        </div>
      )}
    </>
  );
}

function SegmentBtn(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      data-active={props.active}
      className="bim-segment-btn text-[10px]"
    >
      {props.label}
    </button>
  );
}

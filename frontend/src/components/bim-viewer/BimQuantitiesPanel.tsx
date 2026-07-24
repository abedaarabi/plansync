"use client";

import { Box, Layers } from "lucide-react";
import type { BimQuantityEntry } from "@/lib/bim/types";
import type { BimTakeoffSelectionSummary } from "./BimAddToTakeoffDialog";

// fallow-ignore-next-line complexity
export function BimQuantitiesPanel(props: {
  entries: BimQuantityEntry[];
  count: number;
  length: number | null;
  area: number | null;
  volume: number | null;
  selectionSummary?: BimTakeoffSelectionSummary | null;
}) {
  if (props.count === 0) {
    return (
      <div className="bim-detail-card text-center">
        <Layers className="mx-auto mb-2 h-5 w-5 text-[var(--bim-text-muted)]" aria-hidden />
        <p className="text-[12px] font-medium text-[var(--bim-text)]">No selection</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--bim-text-muted)]">
          Select elements in the model to preview rolled-up quantities for takeoff.
        </p>
      </div>
    );
  }

  const summaryLabel = props.selectionSummary
    ? props.selectionSummary.elementCount === 1
      ? "1 element"
      : `${props.selectionSummary.elementCount} elements`
    : `${props.count} selected`;

  return (
    <div className="bim-detail-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="bim-section-title">Model quantities</p>
          <p className="mt-1 text-[12px] font-medium text-[var(--bim-text)]">{summaryLabel}</p>
          {props.selectionSummary?.ifcTypes[0] ? (
            <p className="mt-0.5 text-[11px] text-[var(--bim-text-muted)]">
              {props.selectionSummary.ifcTypes.slice(0, 2).join(", ")}
            </p>
          ) : null}
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bim-accent-muted)] text-[var(--bim-accent)]">
          <Box className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="bim-metric-grid">
        <QtyTile label="Count" value={String(props.count)} />
        {props.length != null ? (
          <QtyTile label="Length" value={`${props.length.toFixed(2)} m`} />
        ) : null}
        {props.area != null ? <QtyTile label="Area" value={`${props.area.toFixed(2)} m²`} /> : null}
        {props.volume != null ? (
          <QtyTile label="Volume" value={`${props.volume.toFixed(2)} m³`} />
        ) : null}
      </div>

      {props.entries.length === 1 &&
      (props.entries[0]?.material || props.entries[0]?.quantitySource !== "missing") ? (
        <dl className="mt-3 space-y-1 border-t border-[var(--bim-border)] pt-3">
          {props.entries[0]?.quantitySource !== "missing" ? (
            <MetaRow label="Source" value={props.entries[0]!.quantitySource} />
          ) : null}
          {props.entries[0]?.material ? (
            <MetaRow label="IFC material" value={props.entries[0].material} />
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

function QtyTile(props: { label: string; value: string }) {
  return (
    <div className="bim-metric-tile">
      <p className="bim-metric-tile-label">{props.label}</p>
      <p className="bim-metric-tile-value">{props.value}</p>
    </div>
  );
}

function MetaRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <dt className="text-[var(--bim-text-muted)]">{props.label}</dt>
      <dd className="font-medium text-[var(--bim-text)]">{props.value}</dd>
    </div>
  );
}

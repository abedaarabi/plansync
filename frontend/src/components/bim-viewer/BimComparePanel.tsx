"use client";

import { GitCompare } from "lucide-react";
import { useProjectMeasurementSystem } from "@/hooks/useProjectMeasurementSystem";
import {
  projectDisplayUnits,
  siQuantityToDisplay,
  type ProjectMeasurementSystem,
} from "@/lib/projectMeasurement";

export function BimComparePanel(props: {
  deltas: {
    ifcType: string;
    countDelta: number;
    areaDelta: number | null;
    volumeDelta: number | null;
  }[];
  baseVersion: number;
  compareVersion: number;
  projectId?: string | null;
}) {
  const { measurementSystem } = useProjectMeasurementSystem(props.projectId ?? undefined);
  const changed = props.deltas.filter(
    (d) => d.countDelta !== 0 || d.areaDelta != null || d.volumeDelta != null,
  );

  // fallow-ignore-next-line complexity
  const rows = changed.slice(0, 30).map((d) => (
    <li
      key={d.ifcType}
      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--bim-border)] px-2.5 py-2 text-[11px]"
    >
      <span className="truncate font-medium text-[var(--bim-text)]">
        {d.ifcType.replace(/^Ifc/i, "")}
      </span>
      <span className="shrink-0 tabular-nums text-[var(--bim-text-muted)]">
        {d.countDelta !== 0 ? `${d.countDelta > 0 ? "+" : ""}${d.countDelta} ea` : ""}
        {d.areaDelta != null
          ? ` · ${formatSignedSiDelta(d.areaDelta, "area", measurementSystem)}`
          : ""}
      </span>
    </li>
  ));

  return (
    <div className="bim-detail-card">
      <p className="bim-section-title mb-1 inline-flex items-center gap-1.5">
        <GitCompare className="h-3.5 w-3.5 text-[var(--bim-accent)]" aria-hidden />
        Version compare
      </p>
      <p className="mb-3 text-[11px] text-[var(--bim-text-muted)]">
        v{props.baseVersion} → v{props.compareVersion}
      </p>
      {changed.length === 0 ? (
        <p className="text-[11px] text-[var(--bim-text-muted)]">No quantity deltas by type.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">{rows}</ul>
      )}
    </div>
  );
}

function formatSignedSiDelta(
  delta: number,
  kind: "area" | "volume",
  system: ProjectMeasurementSystem,
): string {
  const sign = delta > 0 ? "+" : "";
  const n = siQuantityToDisplay(Math.abs(delta), kind, system);
  return `${sign}${n.toFixed(1)} ${projectDisplayUnits(system)[kind]}`;
}

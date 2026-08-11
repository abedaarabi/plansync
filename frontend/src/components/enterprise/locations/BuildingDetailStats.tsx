"use client";

import { Boxes, Crosshair, FileText, Layers } from "lucide-react";
import {
  clashesStat,
  drawingsStat,
  mappingStat,
  modelsStat,
  type BuildingCardStatTone,
} from "./buildingCardStats";

type Props = {
  ifcCount: number;
  readyIfcCount: number;
  pdfCount: number;
  unmappedPdfCount: number;
  levelCount: number;
  mappedLevelCount: number;
  openClashCount: number;
  publishStatus: "setup" | "needs_update" | "ready";
  onSelectTab?: (tab: "levels" | "clashes" | "overview") => void;
  showClashes: boolean;
};

function toneClass(tone: BuildingCardStatTone): string {
  if (tone === "warn") return "text-[var(--enterprise-semantic-warning-text)]";
  if (tone === "ok") return "text-[var(--enterprise-semantic-success-text)]";
  return "text-[var(--enterprise-text)]";
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  tone: BuildingCardStatTone;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--enterprise-text-muted)]">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${toneClass(tone)}`}>
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-left transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-hover-surface)]"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="min-w-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5">
      {inner}
    </div>
  );
}

export function BuildingDetailStats({
  ifcCount,
  readyIfcCount,
  pdfCount,
  unmappedPdfCount,
  levelCount,
  mappedLevelCount,
  openClashCount,
  publishStatus,
  onSelectTab,
  showClashes,
}: Props) {
  const models = modelsStat(ifcCount, readyIfcCount);
  const drawings = drawingsStat(pdfCount, unmappedPdfCount);
  const mapping = mappingStat(levelCount, mappedLevelCount);
  const clashes = clashesStat(openClashCount, publishStatus);

  return (
    <div
      className={`grid gap-2 ${showClashes ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
      aria-label="Building summary"
    >
      <StatCard icon={Boxes} label="Models" value={models.value} tone={models.tone} />
      <StatCard icon={FileText} label="Drawings" value={drawings.value} tone={drawings.tone} />
      <StatCard
        icon={Layers}
        label="Levels"
        value={mapping.value}
        tone={mapping.tone}
        onClick={onSelectTab ? () => onSelectTab("levels") : undefined}
      />
      {showClashes ? (
        <StatCard
          icon={Crosshair}
          label="Clashes"
          value={clashes.value}
          tone={clashes.tone}
          onClick={onSelectTab && openClashCount > 0 ? () => onSelectTab("clashes") : undefined}
        />
      ) : null}
    </div>
  );
}

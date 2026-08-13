"use client";

import { Boxes, Crosshair, FileText, Layers, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { LocationBuildingRow } from "@/lib/api-client/locations";
import {
  buildingMetaLine,
  clashesStat,
  drawingsStat,
  mappingStat,
  modelsStat,
  type BuildingCardStatTone,
} from "./buildingCardStats";
import { BuildingCardStatus } from "./BuildingCardStatus";
import { BuildingImageThumb } from "./BuildingImageThumb";

type Props = {
  building: LocationBuildingRow;
  projectId: string;
  locationId: string;
  onEdit: () => void;
  onDelete: () => void;
};

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
  tone?: BuildingCardStatTone;
}) {
  const valueClass =
    tone === "warn"
      ? "text-[var(--enterprise-semantic-warning-text)]"
      : tone === "ok"
        ? "text-[var(--enterprise-semantic-success-text)]"
        : "text-[var(--enterprise-text)]";
  return (
    <div className="min-w-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1.5">
      <div className="flex items-center gap-1 text-xs font-medium text-[var(--enterprise-text-muted)]">
        <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-0.5 truncate text-xs font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export function BuildingCard({ building: b, projectId, locationId, onEdit, onDelete }: Props) {
  const readyIfcCount = b.readyIfcCount ?? 0;
  const unmappedPdfCount = b.unmappedPdfCount ?? 0;
  const mappedLevelCount = b.mappedLevelCount ?? 0;
  const openClashCount = b.openClashCount ?? 0;

  const models = modelsStat(b.ifcCount, readyIfcCount);
  const drawings = drawingsStat(b.pdfCount, unmappedPdfCount);
  const mapping = mappingStat(b.levelCount, mappedLevelCount);
  const clashes = clashesStat(openClashCount, b.publishStatus);
  const showAttention = openClashCount > 0 || unmappedPdfCount > 0;

  return (
    <div className="enterprise-card enterprise-card-hover group flex flex-col overflow-hidden">
      <Link
        href={`/projects/${projectId}/locations/${locationId}/buildings/${b.id}`}
        className="flex flex-1 flex-col p-4 transition-colors hover:bg-[var(--enterprise-hover-surface)]/50"
      >
        <div className="flex gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--enterprise-border)]">
            <BuildingImageThumb
              buildingId={b.id}
              hasImage={Boolean(b.hasImage)}
              alt=""
              className="h-full w-full object-cover object-center"
              fallbackClassName="flex h-full w-full items-center justify-center bg-[var(--enterprise-hover-surface)]"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold leading-snug text-[var(--enterprise-text)] group-hover:text-[var(--enterprise-primary)]">
                  {b.name}
                </h2>
                {b.code ? (
                  <span className="enterprise-badge-neutral rounded px-1.5 py-0.5 text-xs font-semibold">
                    {b.code}
                  </span>
                ) : null}
              </div>
              <div className="shrink-0">
                <BuildingCardStatus building={b} />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
              {buildingMetaLine(b)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Stat icon={Boxes} label="Models" value={models.value} tone={models.tone} />
          <Stat icon={FileText} label="Drawings" value={drawings.value} tone={drawings.tone} />
          <Stat icon={Layers} label="Levels" value={mapping.value} tone={mapping.tone} />
          <Stat icon={Crosshair} label="Clashes" value={clashes.value} tone={clashes.tone} />
        </div>

        {showAttention ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {openClashCount > 0 ? (
              <span className="enterprise-badge-warning inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold">
                <Crosshair className="h-3 w-3" aria-hidden />
                {openClashCount} open clash{openClashCount === 1 ? "" : "es"}
              </span>
            ) : null}
            {unmappedPdfCount > 0 ? (
              <span className="enterprise-badge-neutral inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold">
                {unmappedPdfCount} PDF to match
              </span>
            ) : null}
          </div>
        ) : null}
      </Link>

      <div className="flex items-center justify-end gap-0.5 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40 px-2 py-1.5">
        <button
          type="button"
          className="mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
          aria-label={`Edit ${b.name}`}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className="mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
          aria-label={`Delete ${b.name}`}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

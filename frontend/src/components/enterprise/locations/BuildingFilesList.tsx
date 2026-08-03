"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Trash2 } from "lucide-react";
import type { BuildingAsset } from "@/lib/api-client/locations";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { ProcessingStatusPill } from "./ProcessingStatusPill";

const PREVIEW_COUNT = 5;

type Props = {
  assets: BuildingAsset[];
  onDelete: (asset: BuildingAsset) => void;
  deletingId?: string | null;
  /** Toggle READY IFC selection for federation. */
  selectedIfcIds?: Set<string>;
  onToggleIfc?: (assetId: string) => void;
  /** Open / rematch a PDF drawing. */
  onOpenPdf?: (asset: BuildingAsset) => void;
};

function assetMeta(asset: BuildingAsset): string {
  const kind = asset.type ?? "File";
  if (asset.type === "PDF") {
    return asset.mappingId
      ? `${kind} · Matched · Click to edit`
      : `${kind} · Unmapped · Click to preview`;
  }
  if (asset.type === "IFC" && asset.version != null) {
    return `${kind} · v${asset.version}`;
  }
  return kind;
}

function typeRank(type: BuildingAsset["type"]): number {
  if (type === "IFC") return 0;
  if (type === "PDF") return 1;
  return 2;
}

function AssetIcon({ asset }: { asset: BuildingAsset }) {
  if (asset.type === "IFC") return <IfcFileIcon className="h-8 w-8 shrink-0" />;
  if (asset.type === "PDF") return <PdfFileIcon className="h-8 w-8 shrink-0" />;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]">
      <FileText className="h-4 w-4" aria-hidden />
    </span>
  );
}

function FileRow({
  asset,
  busy,
  onDelete,
  selected,
  onToggleIfc,
  onOpenPdf,
}: {
  asset: BuildingAsset;
  busy: boolean;
  onDelete: (asset: BuildingAsset) => void;
  selected?: boolean;
  onToggleIfc?: (assetId: string) => void;
  onOpenPdf?: (asset: BuildingAsset) => void;
}) {
  const isReadyIfc = asset.type === "IFC" && asset.status === "READY" && Boolean(onToggleIfc);
  const isPdf = asset.type === "PDF" && Boolean(onOpenPdf);
  const pdfClickable =
    isPdf && (Boolean(asset.mappingId && asset.mappedLevelId) || !asset.mappingId);

  return (
    <li
      className={`flex min-h-12 items-center gap-2.5 px-3 py-2 sm:px-3.5 ${
        pdfClickable ? "cursor-pointer hover:bg-[var(--enterprise-hover-surface)]" : ""
      }`}
      onClick={pdfClickable ? () => onOpenPdf?.(asset) : undefined}
      onKeyDown={
        pdfClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenPdf?.(asset);
              }
            }
          : undefined
      }
      role={pdfClickable ? "button" : undefined}
      tabIndex={pdfClickable ? 0 : undefined}
    >
      {isReadyIfc ? (
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 rounded border-[var(--enterprise-border)] text-[var(--enterprise-primary)] focus:ring-[var(--enterprise-primary)]"
          checked={Boolean(selected)}
          aria-label={`Select ${asset.fileName} for federated view`}
          onChange={() => onToggleIfc?.(asset.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
      <AssetIcon asset={asset} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
          {asset.fileName}
        </p>
        <p className="truncate text-[11px] text-[var(--enterprise-text-muted)]">
          {assetMeta(asset)}
        </p>
      </div>
      <ProcessingStatusPill status={asset.status} />
      <button
        type="button"
        className="mobile-touch-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] focus-visible:bg-[var(--enterprise-semantic-danger-bg)] focus-visible:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50"
        aria-label={`Remove ${asset.fileName}`}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(asset);
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

export function BuildingFilesList({
  assets,
  onDelete,
  deletingId,
  selectedIfcIds,
  onToggleIfc,
  onOpenPdf,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () =>
      [...assets].sort((a, b) => {
        const byType = typeRank(a.type) - typeRank(b.type);
        if (byType !== 0) return byType;
        return a.fileName.localeCompare(b.fileName);
      }),
    [assets],
  );

  if (sorted.length === 0) return null;

  const canCollapse = sorted.length > PREVIEW_COUNT;
  const visible = canCollapse && !expanded ? sorted.slice(0, PREVIEW_COUNT) : sorted;
  const hiddenCount = sorted.length - PREVIEW_COUNT;

  return (
    <div className="enterprise-card overflow-hidden rounded-xl">
      <ul className="divide-y divide-[var(--enterprise-border)]">
        {visible.map((asset) => (
          <FileRow
            key={asset.id}
            asset={asset}
            busy={deletingId === asset.id}
            onDelete={onDelete}
            selected={selectedIfcIds?.has(asset.id)}
            onToggleIfc={onToggleIfc}
            onOpenPdf={onOpenPdf}
          />
        ))}
      </ul>
      {canCollapse ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-2 text-sm font-medium text-[var(--enterprise-primary)] transition hover:bg-[var(--enterprise-primary-soft)]"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp className="h-4 w-4" aria-hidden />
            </>
          ) : (
            <>
              Show {hiddenCount} more
              <ChevronDown className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

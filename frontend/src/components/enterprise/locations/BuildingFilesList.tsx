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
};

function assetMeta(asset: BuildingAsset): string {
  const kind = asset.type ?? "File";
  if (asset.type === "PDF") {
    return asset.mappingId ? `${kind} · Matched to floor plan` : `${kind} · Unmapped`;
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
}: {
  asset: BuildingAsset;
  busy: boolean;
  onDelete: (asset: BuildingAsset) => void;
}) {
  return (
    <li className="flex min-h-12 items-center gap-2.5 px-3 py-2 sm:px-3.5">
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
        onClick={() => onDelete(asset)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

export function BuildingFilesList({ assets, onDelete, deletingId }: Props) {
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

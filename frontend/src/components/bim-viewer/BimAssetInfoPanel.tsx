"use client";

import { Package, X } from "lucide-react";
import type { OmAssetRow } from "@/lib/api-client/operations-maintenance-assets";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value?.trim();
  if (!v) return null;
  return (
    <div>
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[12px] font-medium text-slate-200">{v}</dd>
    </div>
  );
}

export function BimAssetInfoPanel(props: {
  asset: OmAssetRow;
  modelName: string;
  onClose: () => void;
}) {
  const { asset } = props;
  const level = asset.bimAnchor?.spatialPath?.[0]?.trim() || asset.locationLabel?.trim() || null;
  const guid = asset.bimAnchor?.ifcGuid?.trim() || null;

  return (
    <aside
      role="dialog"
      aria-label={`Asset ${asset.tag}`}
      className="absolute left-0 top-0 z-40 flex h-full w-full min-w-0 max-w-[min(360px,calc(100dvw-1rem))] flex-col overflow-x-hidden border-r border-slate-700/80 bg-slate-950 shadow-[16px_0_48px_-12px_rgba(0,0,0,0.55)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/90 px-5 py-3.5">
        <div className="min-w-0 space-y-0.5 pr-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-300/80">
            Asset
          </p>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-white">
            <Package className="h-4 w-4 shrink-0 text-teal-400" strokeWidth={2} aria-hidden />
            <span className="truncate font-mono">{asset.tag}</span>
          </h2>
          <p className="truncate text-[12px] text-slate-400">{asset.name}</p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          className="viewer-focus-ring shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 [scrollbar-color:rgba(71,85,105,0.5)_transparent] [scrollbar-width:thin]">
        <section className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-900/35 p-3 ring-1 ring-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Location & model
          </p>
          <dl className="grid grid-cols-2 gap-3">
            <InfoRow label="Level" value={level} />
            <InfoRow label="Category" value={asset.category} />
            <InfoRow label="Model file" value={asset.file?.name ?? props.modelName} />
            <InfoRow label="Type" value={asset.bimAnchor?.ifcType ?? asset.category} />
          </dl>
        </section>

        <section className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-900/35 p-3 ring-1 ring-white/[0.025]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Equipment
          </p>
          <dl className="grid grid-cols-2 gap-3">
            <InfoRow label="Manufacturer" value={asset.manufacturer} />
            <InfoRow label="Model" value={asset.model} />
            <InfoRow label="Serial" value={asset.serialNumber} />
            <InfoRow
              label="Hall / row / rack"
              value={[asset.hall, asset.rowLabel, asset.rack].filter(Boolean).join(" · ") || null}
            />
          </dl>
        </section>

        {guid ? (
          <section className="space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-900/25 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Linked element
            </p>
            <p className="break-all font-mono text-[10px] text-slate-300">{guid}</p>
            {asset.bimAnchor?.name ? (
              <p className="text-[12px] text-slate-400">{asset.bimAnchor.name}</p>
            ) : null}
          </section>
        ) : null}

        {asset.notes?.trim() ? (
          <section className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-300">
              {asset.notes}
            </p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

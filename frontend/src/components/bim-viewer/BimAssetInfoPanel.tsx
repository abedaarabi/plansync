"use client";

import { Pencil } from "lucide-react";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";
import type { OmAssetRow } from "@/lib/api-client";
import { BimAssetDocumentsSection } from "./BimAssetDocumentsSection";
import { BimGlassDock } from "./BimGlassDock";

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value?.trim();
  if (!v) return null;
  return (
    <div>
      <dt className="text-[10px] font-medium text-[var(--bim-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-[12px] font-medium text-[var(--bim-text)]">{v}</dd>
    </div>
  );
}

export function BimAssetInfoPanel(props: {
  asset: OmAssetRow;
  projectId: string;
  modelName: string;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { asset, projectId } = props;
  const level = asset.bimAnchor?.spatialPath?.[0]?.trim() || asset.locationLabel?.trim() || null;
  const guid = asset.bimAnchor?.ifcGuid?.trim() || null;
  const structuredLocation = [asset.hall, asset.rowLabel, asset.rack, asset.positionU]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <BimGlassDock
      side="right"
      open
      title={asset.tag}
      subtitle={asset.name}
      onClose={props.onClose}
      closeOnOutsideClick={false}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="bim-dock-scroll space-y-3 px-3 py-2.5">
          {asset.hasImage ? (
            <div className="overflow-hidden rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_40%,transparent)]">
              <OmAssetImageThumb
                projectId={projectId}
                assetId={asset.id}
                hasImage={asset.hasImage}
                alt={asset.name}
                className="max-h-36 w-full object-cover object-center"
                fallbackClassName="flex h-24 w-full items-center justify-center bg-[color-mix(in_srgb,var(--bim-panel)_50%,transparent)]"
              />
            </div>
          ) : null}

          <section className="space-y-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_35%,transparent)] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
              Location & model
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Level" value={level} />
              <InfoRow label="Category" value={asset.category} />
              <InfoRow label="Location" value={asset.locationLabel} />
              <InfoRow label="Hall / row / rack" value={structuredLocation || null} />
              <InfoRow label="Model file" value={asset.file?.name ?? props.modelName} />
              <InfoRow label="Type" value={asset.bimAnchor?.ifcType ?? asset.category} />
            </dl>
          </section>

          <section className="space-y-2 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_35%,transparent)] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
              Equipment
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Manufacturer" value={asset.manufacturer} />
              <InfoRow label="Model" value={asset.model} />
              <InfoRow label="Serial" value={asset.serialNumber} />
            </dl>
          </section>

          <BimAssetDocumentsSection projectId={projectId} assetId={asset.id} />

          {guid ? (
            <section className="space-y-1.5 rounded-lg border border-[var(--bim-chrome-border)] bg-[color-mix(in_srgb,var(--bim-panel)_25%,transparent)] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
                Linked element
              </p>
              <p className="break-all font-mono text-[10px] text-[var(--bim-text)]">{guid}</p>
            </section>
          ) : null}

          {asset.notes?.trim() ? (
            <section className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bim-text-muted)]">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--bim-text)]">
                {asset.notes}
              </p>
            </section>
          ) : null}
        </div>

        {props.onEdit ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--bim-chrome-border)] px-3 py-2.5">
            <button
              type="button"
              onClick={props.onEdit}
              className="bim-focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[var(--bim-accent)] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              Edit asset
            </button>
          </footer>
        ) : null}
      </div>
    </BimGlassDock>
  );
}

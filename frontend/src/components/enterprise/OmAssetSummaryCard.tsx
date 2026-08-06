"use client";

import type { ReactNode } from "react";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";

export type OmAssetSummaryFields = {
  tag: string;
  name: string;
  category?: string | null;
  locationLabel?: string | null;
  hall?: string | null;
  rowLabel?: string | null;
  rack?: string | null;
  positionU?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  level?: string | null;
  hasImage?: boolean;
  element?: { name: string | null; ifcType: string | null } | null;
};

function InfoRow({
  label,
  value,
  dense,
}: {
  label: string;
  value: string | null | undefined;
  dense?: boolean;
}) {
  const v = value?.trim();
  if (!v) return null;
  return (
    <div>
      <dt
        className={`font-medium text-[var(--enterprise-text-muted)] ${dense ? "text-[10px]" : "text-[11px]"}`}
      >
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words font-medium text-[var(--enterprise-text)] ${dense ? "text-xs" : "text-sm"}`}
      >
        {v}
      </dd>
    </div>
  );
}

function structuredLocation(asset: OmAssetSummaryFields): string | null {
  const parts = [asset.hall, asset.rowLabel, asset.rack, asset.positionU]
    .map((s) => s?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Equipment summary for occupant report + inbox (photo + fields, no documents).
 */
// fallow-ignore-next-line complexity
export function OmAssetSummaryCard(props: {
  asset: OmAssetSummaryFields;
  /** Authenticated image via project asset id, or a public/presigned URL. */
  image?:
    | { mode: "auth"; projectId: string; assetId: string }
    | { mode: "url"; url: string | null | undefined; loading?: boolean };
  className?: string;
  footer?: ReactNode;
  /** When false, skip the "Equipment" eyebrow (parent already titles the section). */
  showTitle?: boolean;
  /** Compact typography for dense slide-overs. */
  dense?: boolean;
}) {
  const { asset } = props;
  const showTitle = props.showTitle !== false;
  const dense = Boolean(props.dense);
  const hasImage = Boolean(asset.hasImage);
  const locationStruct = structuredLocation(asset);
  const elementLabel = asset.element?.name?.trim() || asset.element?.ifcType?.trim() || null;
  const elementTypeExtra =
    asset.element?.name?.trim() && asset.element?.ifcType?.trim()
      ? asset.element.ifcType.trim()
      : null;

  let photo: ReactNode = null;
  const photoMax = dense ? "max-h-32" : "max-h-44";
  const photoFallbackH = dense ? "h-20" : "h-28";

  if (hasImage && props.image?.mode === "auth") {
    photo = (
      <div className="overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
        <OmAssetImageThumb
          projectId={props.image.projectId}
          assetId={props.image.assetId}
          hasImage
          alt={asset.name}
          className={`${photoMax} w-full object-cover object-center`}
          fallbackClassName={`flex ${photoFallbackH} w-full items-center justify-center bg-[var(--enterprise-bg)]`}
        />
      </div>
    );
  } else if (hasImage && props.image?.mode === "url") {
    photo = (
      <div className="overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
        {props.image.loading || !props.image.url ? (
          <div
            className={`flex ${photoFallbackH} w-full items-center justify-center text-xs text-[var(--enterprise-text-muted)]`}
          >
            Loading photo…
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
          <img
            src={props.image.url}
            alt={asset.name}
            className={`${photoMax} w-full object-cover object-center`}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={
        props.className ??
        "enterprise-card space-y-3 px-4 py-3 text-sm shadow-[var(--enterprise-shadow-xs)]"
      }
    >
      {showTitle ? (
        <p
          className={`font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)] ${dense ? "text-[10px]" : "text-xs"}`}
        >
          Equipment
        </p>
      ) : null}

      {photo}

      <div>
        <p
          className={`font-medium text-[var(--enterprise-text)] ${dense ? "text-[13px]" : "text-sm"}`}
        >
          <span className="font-mono">{asset.tag}</span>
          <span className="font-normal text-[var(--enterprise-text-muted)]"> — </span>
          {asset.name}
        </p>
        {elementLabel ? (
          <p className={`mt-1 text-[var(--enterprise-text)] ${dense ? "text-xs" : "text-sm"}`}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
              Element
            </span>
            <span className="mt-0.5 block">
              {elementLabel}
              {elementTypeExtra ? (
                <span className="text-[var(--enterprise-text-muted)]"> · {elementTypeExtra}</span>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>

      <dl className={`grid grid-cols-2 ${dense ? "gap-2" : "gap-3"}`}>
        <InfoRow dense={dense} label="Level" value={asset.level} />
        <InfoRow dense={dense} label="Category" value={asset.category} />
        <InfoRow dense={dense} label="Location" value={asset.locationLabel} />
        <InfoRow dense={dense} label="Hall / row / rack" value={locationStruct} />
        <InfoRow dense={dense} label="Manufacturer" value={asset.manufacturer} />
        <InfoRow dense={dense} label="Model" value={asset.model} />
        <InfoRow dense={dense} label="Serial" value={asset.serialNumber} />
      </dl>

      {asset.notes?.trim() ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            Notes
          </p>
          <p
            className={`mt-1 whitespace-pre-wrap leading-relaxed text-[var(--enterprise-text)] ${dense ? "text-xs" : "text-sm"}`}
          >
            {asset.notes.trim()}
          </p>
        </div>
      ) : null}

      {props.footer}
    </div>
  );
}

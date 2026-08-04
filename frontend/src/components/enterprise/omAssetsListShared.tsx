"use client";

import type { LucideIcon } from "lucide-react";
import { Boxes, Link2, Package, PanelRightOpen, Pencil, Unlink } from "lucide-react";
import type { OmAssetRow } from "@/lib/api-client";
import { assetHasSheetPin } from "@/lib/assetPinFocus";
import {
  omAssetCanOpenBim,
  omAssetCanOpenDrawing,
  omAssetHasBimLink,
} from "@/lib/omAssetViewerNavigation";
import type { CloudFile } from "@/types/projects";

export type OmAssetsListActions = {
  projectId: string;
  projectFiles: CloudFile[];
  formatLocation: (a: OmAssetRow) => string;
  onOpenDetail: (asset: OmAssetRow) => void;
  onEdit: (asset: OmAssetRow) => void;
  onLink: (asset: OmAssetRow) => void;
  onViewDrawing: (asset: OmAssetRow) => void;
  onViewBim: (asset: OmAssetRow) => void;
  onClearLink: (assetId: string) => void;
  clearLinkPending: boolean;
};

type AssetRowActionsProps = Pick<
  OmAssetsListActions,
  | "projectFiles"
  | "onOpenDetail"
  | "onEdit"
  | "onLink"
  | "onViewDrawing"
  | "onViewBim"
  | "onClearLink"
  | "clearLinkPending"
> & {
  asset: OmAssetRow;
  className?: string;
};

export function AssetRowActions({
  asset,
  projectFiles,
  onOpenDetail,
  onEdit,
  onLink,
  onViewDrawing,
  onViewBim,
  onClearLink,
  clearLinkPending,
  className = "inline-flex items-center justify-end gap-0.5",
}: AssetRowActionsProps) {
  const canOpenDrawing = omAssetCanOpenDrawing(asset, projectFiles);
  const canOpenBim = omAssetCanOpenBim(asset, projectFiles);
  const hasAnyLink = Boolean(asset.fileId) || omAssetHasBimLink(asset);

  return (
    <div className={className}>
      <AssetRowActionButton
        label={`Details for ${asset.tag}`}
        Icon={PanelRightOpen}
        onClick={() => onOpenDetail(asset)}
      />
      <AssetRowActionButton
        label={`Edit ${asset.tag}`}
        Icon={Pencil}
        onClick={() => onEdit(asset)}
      />
      {canOpenDrawing ? (
        <AssetRowActionButton
          label={
            assetHasSheetPin(asset) ? `View pin for ${asset.tag}` : `Open drawing for ${asset.tag}`
          }
          Icon={Package}
          teal
          onClick={() => onViewDrawing(asset)}
        />
      ) : null}
      {canOpenBim ? (
        <AssetRowActionButton
          label={`Open 3D for ${asset.tag}`}
          Icon={Boxes}
          teal
          onClick={() => onViewBim(asset)}
        />
      ) : null}
      <AssetRowActionButton
        label={`Link drawing for ${asset.tag}`}
        Icon={Link2}
        onClick={() => onLink(asset)}
      />
      {hasAnyLink ? (
        <AssetRowActionButton
          label={
            omAssetHasBimLink(asset)
              ? `Clear model / drawing link for ${asset.tag}`
              : `Clear drawing link for ${asset.tag}`
          }
          Icon={Unlink}
          danger
          disabled={clearLinkPending}
          onClick={() => onClearLink(asset.id)}
        />
      ) : null}
    </div>
  );
}

const ASSET_ROW_ACTION_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40 disabled:opacity-40";

const ASSET_ROW_ACTION_DANGER_CLASS =
  "hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]";

const ASSET_ROW_ACTION_TEAL_CLASS =
  "text-teal-700 hover:bg-teal-500/10 hover:text-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/40 dark:hover:text-teal-200";

function AssetRowActionButton({
  label,
  Icon,
  danger,
  teal,
  disabled,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  danger?: boolean;
  teal?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${ASSET_ROW_ACTION_CLASS} ${danger ? ASSET_ROW_ACTION_DANGER_CLASS : ""} ${teal ? ASSET_ROW_ACTION_TEAL_CLASS : ""}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function DrawingStatusBadge({ asset }: { asset: OmAssetRow }) {
  const hasBim = omAssetHasBimLink(asset);
  const hasSheet = Boolean(asset.fileId) || assetHasSheetPin(asset);
  if (hasBim && hasSheet) {
    return (
      <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200">
        3D + sheet
      </span>
    );
  }
  if (hasBim) {
    return (
      <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200">
        3D model
      </span>
    );
  }
  if (assetHasSheetPin(asset)) {
    return (
      <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-800 dark:text-teal-200">
        Pin on sheet
      </span>
    );
  }
  if (asset.file) {
    return (
      <span className="enterprise-badge-neutral inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
        Sheet linked
      </span>
    );
  }
  return <span className="text-xs text-[var(--enterprise-text-muted)]">—</span>;
}

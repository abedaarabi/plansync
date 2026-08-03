"use client";

import { Boxes, Link2, MapPin, Package, PanelRightOpen, Pencil } from "lucide-react";
import type { OmAssetRow } from "@/lib/api-client";
import { assetHasSheetPin } from "@/lib/assetPinFocus";
import { omAssetHasBimLink } from "@/lib/omAssetViewerNavigation";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";

function DrawingStatusBadge({ asset }: { asset: OmAssetRow }) {
  if (omAssetHasBimLink(asset)) {
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

const actionBtn =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 text-xs font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-ring-focus)]";

type Props = {
  projectId: string;
  rows: OmAssetRow[];
  formatLocation: (a: OmAssetRow) => string;
  onOpenDetail: (asset: OmAssetRow) => void;
  onEdit: (asset: OmAssetRow) => void;
  onLink: (asset: OmAssetRow) => void;
  onViewDrawing: (asset: OmAssetRow) => void;
  onClearLink: (assetId: string) => void;
  clearLinkPending: boolean;
};

export function OmAssetsTable({
  projectId,
  rows,
  formatLocation,
  onOpenDetail,
  onEdit,
  onLink,
  onViewDrawing,
  onClearLink,
  clearLinkPending,
}: Props) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-16" />
          <col className="w-[9%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[11%]" />
          <col />
        </colgroup>
        <thead className="sticky top-0 z-[3]">
          <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            <th className="sticky left-0 z-[4] bg-[var(--enterprise-surface)] px-3 py-3">Photo</th>
            <th className="sticky left-16 z-[4] bg-[var(--enterprise-surface)] px-3 py-3">Tag</th>
            <th className="px-3 py-3">Name</th>
            <th className="px-3 py-3">Category</th>
            <th className="px-3 py-3">Location</th>
            <th className="px-3 py-3">Link</th>
            <th className="whitespace-nowrap px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            // fallow-ignore-next-line complexity
            (a) => (
              <tr
                key={a.id}
                className="group border-b border-[var(--enterprise-border)]/70 whitespace-nowrap transition hover:bg-[var(--enterprise-hover-surface)]/50"
              >
                <td className="sticky left-0 z-[2] cursor-pointer bg-[var(--enterprise-surface)] px-3 py-2.5 group-hover:bg-[var(--enterprise-hover-surface)]/50">
                  <button
                    type="button"
                    className="block h-11 w-11 overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
                    aria-label={`Open ${a.tag}`}
                    onClick={() => onOpenDetail(a)}
                  >
                    <OmAssetImageThumb
                      projectId={projectId}
                      assetId={a.id}
                      hasImage={a.hasImage}
                      alt={a.name}
                      fallbackClassName="flex h-11 w-11 items-center justify-center bg-[var(--enterprise-bg)]"
                    />
                  </button>
                </td>
                <td
                  className="sticky left-16 z-[2] cursor-pointer bg-[var(--enterprise-surface)] px-3 py-2.5 group-hover:bg-[var(--enterprise-hover-surface)]/50"
                  onClick={() => onOpenDetail(a)}
                >
                  <span className="font-mono text-xs font-bold text-[var(--enterprise-primary)]">
                    {a.tag}
                  </span>
                </td>
                <td
                  className="cursor-pointer truncate px-3 py-2.5 font-medium text-[var(--enterprise-text)]"
                  onClick={() => onOpenDetail(a)}
                >
                  {a.name}
                </td>
                <td
                  className="cursor-pointer truncate px-3 py-2.5 text-[var(--enterprise-text-muted)]"
                  onClick={() => onOpenDetail(a)}
                >
                  {a.category?.trim() || "—"}
                </td>
                <td
                  className="cursor-pointer truncate px-3 py-2.5 text-[var(--enterprise-text-muted)]"
                  onClick={() => onOpenDetail(a)}
                >
                  <span className="inline-flex max-w-full items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    <span className="truncate">{formatLocation(a)}</span>
                  </span>
                </td>
                <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpenDetail(a)}>
                  <DrawingStatusBadge asset={a} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                    <button
                      type="button"
                      aria-label={`Details for ${a.tag}`}
                      onClick={() => onOpenDetail(a)}
                      className={actionBtn}
                    >
                      <PanelRightOpen className="h-3.5 w-3.5" strokeWidth={2} />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${a.tag}`}
                      onClick={() => onEdit(a)}
                      className={actionBtn}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    {a.fileId ? (
                      <button
                        type="button"
                        aria-label={
                          omAssetHasBimLink(a)
                            ? `Open 3D for ${a.tag}`
                            : assetHasSheetPin(a)
                              ? `View pin for ${a.tag}`
                              : `Open drawing for ${a.tag}`
                        }
                        onClick={() => onViewDrawing(a)}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-teal-200/80 bg-teal-500/5 px-2.5 text-xs font-medium text-teal-800 hover:bg-teal-50 dark:border-teal-900/50 dark:text-teal-200 dark:hover:bg-teal-950/40"
                      >
                        {omAssetHasBimLink(a) ? (
                          <Boxes className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Package className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        <span className="hidden md:inline">
                          {omAssetHasBimLink(a) ? "3D" : assetHasSheetPin(a) ? "Pin" : "Drawing"}
                        </span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Link drawing for ${a.tag}`}
                      onClick={() => onLink(a)}
                      className={actionBtn}
                    >
                      <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
                      <span className="hidden sm:inline">Link</span>
                    </button>
                    {a.fileId ? (
                      <button
                        type="button"
                        aria-label={
                          omAssetHasBimLink(a)
                            ? `Clear 3D link for ${a.tag}`
                            : `Clear drawing link for ${a.tag}`
                        }
                        disabled={clearLinkPending}
                        onClick={() => onClearLink(a.id)}
                        className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

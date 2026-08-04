"use client";

import { MapPin } from "lucide-react";
import type { OmAssetRow } from "@/lib/api-client";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";
import {
  AssetRowActions,
  DrawingStatusBadge,
  type OmAssetsListActions,
} from "@/components/enterprise/omAssetsListShared";

type Props = OmAssetsListActions & {
  rows: OmAssetRow[];
};

export function OmAssetsTable({
  projectId,
  projectFiles,
  rows,
  formatLocation,
  onOpenDetail,
  onEdit,
  onLink,
  onViewDrawing,
  onViewBim,
  onClearLink,
  clearLinkPending,
}: Props) {
  return (
    <div className="enterprise-scrollbar w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[3]">
          <tr className="border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            <th className="sticky left-0 z-[4] hidden w-16 bg-[var(--enterprise-surface)] px-3 py-3 md:table-cell">
              Photo
            </th>
            <th className="sticky left-0 z-[4] w-[7.5rem] bg-[var(--enterprise-surface)] px-3 py-3 md:left-16">
              Tag
            </th>
            <th className="min-w-[8rem] px-3 py-3">Name</th>
            <th className="hidden w-[7rem] px-3 py-3 lg:table-cell">Category</th>
            <th className="hidden min-w-[8rem] px-3 py-3 sm:table-cell">Location</th>
            <th className="w-[6.5rem] px-3 py-3">Link</th>
            <th className="w-[9.5rem] px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const location = formatLocation(a);
            return (
              <tr
                key={a.id}
                className="group border-b border-[var(--enterprise-border)]/70 transition hover:bg-[var(--enterprise-hover-surface)]/50"
              >
                <td className="sticky left-0 z-[2] hidden cursor-pointer bg-[var(--enterprise-surface)] px-3 py-2.5 group-hover:bg-[var(--enterprise-hover-surface)]/50 md:table-cell">
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
                  className="sticky left-0 z-[2] cursor-pointer bg-[var(--enterprise-surface)] px-3 py-2.5 group-hover:bg-[var(--enterprise-hover-surface)]/50 md:left-16"
                  onClick={() => onOpenDetail(a)}
                >
                  <span className="font-mono text-xs font-bold text-[var(--enterprise-primary)]">
                    {a.tag}
                  </span>
                </td>
                <td
                  className="max-w-[12rem] cursor-pointer truncate px-3 py-2.5 font-medium text-[var(--enterprise-text)]"
                  title={a.name}
                  onClick={() => onOpenDetail(a)}
                >
                  {a.name}
                </td>
                <td
                  className="hidden max-w-[8rem] cursor-pointer truncate px-3 py-2.5 text-[var(--enterprise-text-muted)] lg:table-cell"
                  title={a.category?.trim() || undefined}
                  onClick={() => onOpenDetail(a)}
                >
                  {a.category?.trim() || "—"}
                </td>
                <td
                  className="hidden max-w-[10rem] cursor-pointer truncate px-3 py-2.5 text-[var(--enterprise-text-muted)] sm:table-cell"
                  title={location}
                  onClick={() => onOpenDetail(a)}
                >
                  <span className="inline-flex max-w-full items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    <span className="truncate">{location}</span>
                  </span>
                </td>
                <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpenDetail(a)}>
                  <DrawingStatusBadge asset={a} />
                </td>
                <td className="px-2 py-2.5 text-right">
                  <AssetRowActions
                    asset={a}
                    projectFiles={projectFiles}
                    onOpenDetail={onOpenDetail}
                    onEdit={onEdit}
                    onLink={onLink}
                    onViewDrawing={onViewDrawing}
                    onViewBim={onViewBim}
                    onClearLink={onClearLink}
                    clearLinkPending={clearLinkPending}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OmAssetsMobileList({
  projectId,
  projectFiles,
  rows,
  formatLocation,
  onOpenDetail,
  onEdit,
  onLink,
  onViewDrawing,
  onViewBim,
  onClearLink,
  clearLinkPending,
}: Props) {
  return (
    <ul className="divide-y divide-[var(--enterprise-border)]/70">
      {rows.map((a) => {
        const location = formatLocation(a);
        return (
          <li key={a.id} className="mobile-list-row px-3 py-3 sm:px-4">
            <div className="flex gap-3">
              <button
                type="button"
                className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]"
                aria-label={`Open ${a.tag}`}
                onClick={() => onOpenDetail(a)}
              >
                <OmAssetImageThumb
                  projectId={projectId}
                  assetId={a.id}
                  hasImage={a.hasImage}
                  alt={a.name}
                  fallbackClassName="flex h-12 w-12 items-center justify-center bg-[var(--enterprise-bg)]"
                />
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpenDetail(a)}
              >
                <p className="font-mono text-xs font-bold text-[var(--enterprise-primary)]">
                  {a.tag}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-[var(--enterprise-text)]">
                  {a.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--enterprise-text-muted)]">
                  <span className="truncate">{a.category?.trim() || "Uncategorized"}</span>
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                    <span className="truncate">{location}</span>
                  </span>
                </p>
                <div className="mt-1.5">
                  <DrawingStatusBadge asset={a} />
                </div>
              </button>
            </div>
            <AssetRowActions
              asset={a}
              projectFiles={projectFiles}
              className="mt-2 flex items-center justify-end gap-0.5"
              onOpenDetail={onOpenDetail}
              onEdit={onEdit}
              onLink={onLink}
              onViewDrawing={onViewDrawing}
              onViewBim={onViewBim}
              onClearLink={onClearLink}
              clearLinkPending={clearLinkPending}
            />
          </li>
        );
      })}
    </ul>
  );
}

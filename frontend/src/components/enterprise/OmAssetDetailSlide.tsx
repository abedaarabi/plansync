"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, MapPin, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  ASSET_METER_TYPE_LABEL,
  fetchOmMaintenanceCompletions,
  fetchOmMaintenance,
  fetchIssuesForProject,
  type IssueRow,
  type OmMaintenanceCompletionRow,
  type OmAssetRow,
  type OmMaintenanceRow,
} from "@/lib/api-client";
import { sortedVersions } from "@/components/file-explorer/fileExplorerUtils";
import { assetHasSheetPin } from "@/lib/assetPinFocus";
import { openBimViewer } from "@/lib/bim/openBimViewer";
import {
  omAssetBimViewerHref,
  omAssetHasBimLink,
  omAssetViewerHref,
} from "@/lib/omAssetViewerNavigation";
import { projectScopedHref } from "@/lib/projectScopedPath";
import { qk } from "@/lib/queryKeys";
import type { CloudFile } from "@/types/projects";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { OmAssetDocumentsBlock } from "@/components/enterprise/OmAssetDocumentsBlock";
import { OmAssetImageThumb } from "@/components/enterprise/OmAssetImageThumb";
import { OmAssetMeterReadingsBlock } from "@/components/enterprise/OmAssetMeterReadingsBlock";
import { OmAssetTenantQrBlock } from "@/components/enterprise/OmAssetTenantQrBlock";

function formatDetailDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  asset: OmAssetRow | null;
  pdfFiles: CloudFile[];
  onEdit: () => void;
  onDelete: (asset: OmAssetRow) => void;
};

// fallow-ignore-next-line complexity
export function OmAssetDetailSlide({
  open,
  onClose,
  projectId,
  asset,
  pdfFiles,
  onEdit,
  onDelete,
}: Props) {
  const router = useRouter();
  const { primary } = useEnterpriseWorkspace();
  const workspaceId = primary?.workspace.id;
  const assetId = asset?.id ?? "";

  const { data: maintenance = [] } = useQuery({
    queryKey: qk.omMaintenance(projectId),
    queryFn: () => fetchOmMaintenance(projectId),
    enabled: open && Boolean(assetId),
  });
  const { data: completionHistory = [] } = useQuery({
    queryKey: qk.omMaintenanceCompletions(projectId, assetId),
    queryFn: () => fetchOmMaintenanceCompletions(projectId, { assetId, limit: 30 }),
    enabled: open && Boolean(assetId),
  });

  const assetIssuesKey = "WORK_ORDER,OCCUPANT";
  const { data: assetWorkOrders = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId, undefined, assetIssuesKey, assetId),
    queryFn: () =>
      fetchIssuesForProject(projectId, { issueKinds: ["WORK_ORDER", "OCCUPANT"], assetId }),
    enabled: open && Boolean(assetId),
  });

  const schedulesForAsset = useMemo(
    () => maintenance.filter((m) => m.assetId === assetId),
    [maintenance, assetId],
  );

  const serviceHistory = useMemo(
    () =>
      completionHistory.map((c: OmMaintenanceCompletionRow) => ({
        id: c.id,
        at: c.completedAt,
        title: c.schedule.title.trim() || c.schedule.frequency,
        vendor: c.vendorLabel?.trim() || "",
        completedBy: c.completedBy?.name || c.completedBy?.email || "",
        workOrderTitle: c.workOrder?.title || "",
      })),
    [completionHistory],
  );

  const nextSchedule = useMemo((): OmMaintenanceRow | null => {
    const active = schedulesForAsset.filter((s) => s.isActive && s.nextDueAt);
    if (active.length === 0) return null;
    active.sort((a, b) => new Date(a.nextDueAt!).getTime() - new Date(b.nextDueAt!).getTime());
    return active[0] ?? null;
  }, [schedulesForAsset]);

  const openWorkOrders = useMemo(
    () => assetWorkOrders.filter((i) => i.status !== "CLOSED"),
    [assetWorkOrders],
  );

  const openViewerForAsset = useCallback(() => {
    if (!asset?.fileId) return;
    if (omAssetHasBimLink(asset)) {
      const href = omAssetBimViewerHref(projectId, asset);
      if (!href) {
        toast.error("Could not open 3D model for this asset.");
        return;
      }
      onClose();
      openBimViewer(href);
      return;
    }
    const f = pdfFiles.find((x) => x.id === asset.fileId);
    if (!f) {
      toast.error("Drawing file not found in project.");
      return;
    }
    const sorted = sortedVersions(f);
    const verRow = sorted.find((v) => v.id === asset.fileVersionId) ?? sorted[0];
    if (!verRow) {
      toast.error("No revision available for this drawing.");
      return;
    }
    router.push(omAssetViewerHref(projectId, f, asset, verRow));
    onClose();
  }, [asset, pdfFiles, projectId, router, onClose]);

  const maintenanceHref = projectScopedHref(projectId, "/om/maintenance", workspaceId);
  const workOrdersHref = projectScopedHref(
    projectId,
    `/om/work-orders?assetId=${encodeURIComponent(assetId)}`,
    workspaceId,
  );

  if (!asset) return null;

  return (
    <EnterpriseSlideOver
      open={open}
      onClose={onClose}
      ariaLabelledBy="asset-detail-title"
      panelMaxWidthClass="max-w-lg"
      overlayZClass="z-[100]"
      header={
        <div>
          <h2
            id="asset-detail-title"
            className="text-lg font-semibold leading-snug text-[var(--enterprise-text)]"
          >
            <span className="font-mono text-[var(--enterprise-primary)]">{asset.tag}</span>
          </h2>
          <p className="mt-1 text-sm font-medium text-[var(--enterprise-text)]">{asset.name}</p>
          {asset.category?.trim() ? (
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">{asset.category}</p>
          ) : null}
        </div>
      }
      footer={
        <div className="flex w-full flex-col gap-2">
          <Link
            href={workOrdersHref}
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 text-sm font-semibold text-white hover:opacity-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Create work order
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--enterprise-border)] px-3 text-sm font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} />
              Edit asset
            </button>
            <button
              type="button"
              onClick={() => onDelete(asset)}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              Delete
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-sm text-[var(--enterprise-text)]">
        <div className="overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
          {asset.hasImage ? (
            <OmAssetImageThumb
              projectId={projectId}
              assetId={asset.id}
              hasImage={asset.hasImage}
              alt={asset.name}
              className="max-h-52 w-full object-cover object-center"
              fallbackClassName="flex h-36 w-full items-center justify-center bg-[var(--enterprise-bg)]"
            />
          ) : (
            <div className="flex h-28 items-center justify-center bg-[var(--enterprise-hover-surface)]/40">
              <Package className="h-8 w-8 text-[var(--enterprise-primary)]/40" strokeWidth={1.5} />
            </div>
          )}
          <div className="space-y-2 border-t border-[var(--enterprise-border)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              {omAssetHasBimLink(asset) ? (
                <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:text-sky-200">
                  Linked in 3D
                </span>
              ) : assetHasSheetPin(asset) ? (
                <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-teal-800 dark:text-teal-200">
                  Pin on drawing
                </span>
              ) : asset.file ? (
                <span className="enterprise-badge-neutral inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
                  Sheet linked
                </span>
              ) : (
                <span className="text-xs text-[var(--enterprise-text-muted)]">
                  No drawing linked
                </span>
              )}
            </div>
            <p className="flex items-start gap-2 text-[var(--enterprise-text-muted)]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="font-medium text-[var(--enterprise-text)]">
                {asset.bimAnchor?.spatialPath?.[0]?.trim() ||
                  asset.locationLabel?.trim() ||
                  [asset.hall, asset.rowLabel, asset.rack, asset.positionU]
                    .filter(Boolean)
                    .join(" / ") ||
                  "No location set"}
              </span>
            </p>
            {asset.fileId ? (
              <button
                type="button"
                onClick={openViewerForAsset}
                className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
              >
                {omAssetHasBimLink(asset)
                  ? "Open in 3D viewer"
                  : assetHasSheetPin(asset)
                    ? "Zoom to equipment pin"
                    : "Open linked drawing"}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            Details
          </h3>
          <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-[13px]">
            <dt className="text-[var(--enterprise-text-muted)]">Manufacturer</dt>
            <dd>{asset.manufacturer?.trim() || "—"}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Model</dt>
            <dd>{asset.model?.trim() || "—"}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Serial</dt>
            <dd className="font-mono text-xs">{asset.serialNumber?.trim() || "—"}</dd>
            {asset.bimAnchor?.ifcType ? (
              <>
                <dt className="text-[var(--enterprise-text-muted)]">IFC type</dt>
                <dd>{asset.bimAnchor.ifcType}</dd>
              </>
            ) : null}
            {asset.file?.name ? (
              <>
                <dt className="text-[var(--enterprise-text-muted)]">
                  {omAssetHasBimLink(asset) ? "3D model" : "Drawing"}
                </dt>
                <dd className="truncate">{asset.file.name}</dd>
              </>
            ) : null}
            <dt className="text-[var(--enterprise-text-muted)]">Installed</dt>
            <dd>{formatDetailDate(asset.installDate)}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Warranty</dt>
            <dd>{formatDetailDate(asset.warrantyExpires)}</dd>
          </dl>
        </section>

        <OmAssetTenantQrBlock
          projectId={projectId}
          assetId={asset.id}
          assetTag={asset.tag}
          assetName={asset.name}
          enabled={open}
        />

        <OmAssetDocumentsBlock projectId={projectId} assetId={asset.id} enabled={open} />

        <section>
          <h3 className="mb-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Meter readings
          </h3>
          <OmAssetMeterReadingsBlock projectId={projectId} assetId={asset.id} enabled={open} />
        </section>

        <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            Service history
          </h3>
          {serviceHistory.length === 0 ? (
            <p className="text-[13px] text-[var(--enterprise-text-muted)]">
              No completed services recorded yet. Complete a schedule from Maintenance (PPM).
            </p>
          ) : (
            <ul className="space-y-2">
              {serviceHistory.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-snug"
                >
                  <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                    ✓
                  </span>
                  <span className="tabular-nums text-[var(--enterprise-text-muted)]">
                    {formatDetailDate(row.at)}
                  </span>
                  <span className="font-medium">{row.title}</span>
                  {row.vendor ? (
                    <span className="text-[var(--enterprise-text-muted)]">{row.vendor}</span>
                  ) : null}
                  {row.completedBy ? (
                    <span className="text-[var(--enterprise-text-muted)]">
                      by {row.completedBy}
                    </span>
                  ) : null}
                  {row.workOrderTitle ? (
                    <span className="text-[var(--enterprise-text-muted)]">
                      · WO {row.workOrderTitle}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            Next scheduled
          </h3>
          {!nextSchedule ? (
            <p className="text-[13px] text-[var(--enterprise-text-muted)]">No upcoming PPM.</p>
          ) : (
            <div className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] p-3">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]" />
                <div>
                  <p className="font-medium tabular-nums">
                    {formatDetailDate(nextSchedule.nextDueAt)}{" "}
                    <span className="font-normal text-[var(--enterprise-text)]">
                      {nextSchedule.title.trim() || "Maintenance"}
                    </span>
                  </p>
                  {nextSchedule.assignedVendorLabel?.trim() ? (
                    <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                      Assigned: {nextSchedule.assignedVendorLabel.trim()}
                    </p>
                  ) : null}
                  {nextSchedule.meterType && nextSchedule.meterThreshold != null ? (
                    <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                      Meter trigger:{" "}
                      {ASSET_METER_TYPE_LABEL[
                        nextSchedule.meterType as keyof typeof ASSET_METER_TYPE_LABEL
                      ] ?? nextSchedule.meterType}{" "}
                      ≥ {nextSchedule.meterThreshold}
                    </p>
                  ) : null}
                  <Link
                    href={maintenanceHref}
                    onClick={onClose}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                  >
                    View schedule
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
            Open work orders &amp; tenant requests
          </h3>
          {openWorkOrders.length === 0 ? (
            <p className="text-[13px] text-[var(--enterprise-text-muted)]">
              No open work orders or tenant requests for this asset.
            </p>
          ) : (
            <ul className="space-y-2">
              {openWorkOrders.map((wo: IssueRow) => (
                <li key={wo.id} className="text-[13px]">
                  <span className="font-medium text-[var(--enterprise-text)]">{wo.title}</span>
                  <span className="ml-2 text-[var(--enterprise-text-muted)]">({wo.status})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </EnterpriseSlideOver>
  );
}

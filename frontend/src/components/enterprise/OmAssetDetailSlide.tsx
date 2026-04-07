"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  fetchOmMaintenance,
  fetchIssuesForProject,
  type IssueRow,
  type OmAssetRow,
  type OmMaintenanceRow,
} from "@/lib/api-client";
import { sortedVersions } from "@/components/file-explorer/fileExplorerUtils";
import { qk } from "@/lib/queryKeys";
import type { CloudFile } from "@/types/projects";
import { EnterpriseSlideOver } from "@/components/enterprise/EnterpriseSlideOver";
import { OmAssetDocumentsBlock } from "@/components/enterprise/OmAssetDocumentsBlock";

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
  const assetId = asset?.id ?? "";

  const { data: maintenance = [] } = useQuery({
    queryKey: qk.omMaintenance(projectId),
    queryFn: () => fetchOmMaintenance(projectId),
    enabled: open && Boolean(assetId),
  });

  const { data: assetWorkOrders = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId, undefined, "WORK_ORDER", assetId),
    queryFn: () => fetchIssuesForProject(projectId, { issueKind: "WORK_ORDER", assetId }),
    enabled: open && Boolean(assetId),
  });

  const schedulesForAsset = useMemo(
    () => maintenance.filter((m) => m.assetId === assetId),
    [maintenance, assetId],
  );

  const serviceHistory = useMemo(() => {
    const rows = schedulesForAsset
      .filter((s) => s.lastCompletedAt)
      .map((s) => ({
        id: s.id,
        at: s.lastCompletedAt!,
        title: s.title.trim() || "Service",
        vendor: s.assignedVendorLabel?.trim() || "",
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return rows;
  }, [schedulesForAsset]);

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
    const f = pdfFiles.find((x) => x.id === asset.fileId);
    if (!f) {
      toast.error("Drawing file not found in project.");
      return;
    }
    const sorted = sortedVersions(f);
    const verRow = sorted.find((v) => v.id === asset.fileVersionId) ?? sorted[0];
    const q = new URLSearchParams({
      fileId: f.id,
      name: f.name,
      projectId,
      omAssetLink: "1",
      omAssetId: asset.id,
      omAssetTag: encodeURIComponent(asset.tag),
      omAssetName: encodeURIComponent(asset.name),
    });
    if (verRow) {
      q.set("version", String(verRow.version));
      q.set("fileVersionId", verRow.id);
    }
    router.push(`/viewer?${q.toString()}`);
    onClose();
  }, [asset, pdfFiles, projectId, router, onClose]);

  const maintenanceHref = `/projects/${projectId}/om/maintenance`;
  const workOrdersHref = `/projects/${projectId}/om/work-orders?assetId=${encodeURIComponent(assetId)}`;

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
            className="text-lg font-semibold text-[var(--enterprise-text)]"
          >
            <span className="font-mono">{asset.tag}</span>
            <span className="font-normal text-[var(--enterprise-text-muted)]"> — </span>
            <span>{asset.name}</span>
          </h2>
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
      <div className="space-y-6 text-sm text-[var(--enterprise-text)]">
        <section>
          <div className="flex items-start gap-2 text-[var(--enterprise-text-muted)]">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-primary)]"
              strokeWidth={2}
            />
            <div>
              <p className="font-medium text-[var(--enterprise-text)]">
                {asset.locationLabel?.trim() || "No location label"}
              </p>
              {asset.fileId ? (
                <button
                  type="button"
                  onClick={openViewerForAsset}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--enterprise-primary)] hover:underline"
                >
                  View on drawing
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              ) : (
                <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
                  No drawing linked.
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Details
          </h3>
          <dl className="grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1.5 text-[13px]">
            <dt className="text-[var(--enterprise-text-muted)]">Category</dt>
            <dd>{asset.category?.trim() || "—"}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Manufacturer</dt>
            <dd>{asset.manufacturer?.trim() || "—"}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Model</dt>
            <dd>{asset.model?.trim() || "—"}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Serial</dt>
            <dd className="font-mono text-xs">{asset.serialNumber?.trim() || "—"}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Install date</dt>
            <dd>{formatDetailDate(asset.installDate)}</dd>
            <dt className="text-[var(--enterprise-text-muted)]">Warranty exp</dt>
            <dd>{formatDetailDate(asset.warrantyExpires)}</dd>
          </dl>
        </section>

        <OmAssetDocumentsBlock projectId={projectId} assetId={asset.id} enabled={open} />

        <section>
          <h3 className="mb-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
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
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
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

        <section>
          <h3 className="mb-2 border-b border-[var(--enterprise-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Open work orders
          </h3>
          {openWorkOrders.length === 0 ? (
            <p className="text-[13px] text-[var(--enterprise-text-muted)]">No open work orders.</p>
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

"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpFromLine,
  Building2,
  CheckCircle2,
  FolderClosed,
  HardDrive,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { MOBILE_FIELD_SELECT } from "@/lib/mobileFormStyles";
import type { BuildingDiscipline } from "@/lib/api-client/locations";
import { DeviceSource, type PickedFile } from "./DeviceSource";
import { ProjectFilesSource } from "./ProjectFilesSource";
import { useBatchUpload, type UploadRow } from "./useBatchUpload";
import { formatBytes, iconClassForKind, iconForKind, kindLabel } from "./fileKind";

type Source = "device" | "project";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  buildingName: string;
  projectId: string;
  locationId: string;
  workspaceId: string;
};

const DISCIPLINES: { value: BuildingDiscipline; label: string }[] = [
  { value: null, label: "Unassigned" },
  { value: "ARCHITECTURAL", label: "Architectural" },
  { value: "STRUCTURAL", label: "Structural" },
  { value: "MEP", label: "MEP" },
  { value: "CIVIL", label: "Civil" },
  { value: "OTHER", label: "Other" },
];

function StatusBadge({ row }: { row: UploadRow }) {
  if (row.status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--enterprise-primary)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Uploading {row.progress}%
      </span>
    );
  }
  if (row.status === "processing") {
    return <span className="enterprise-badge-warning text-xs">Processing</span>;
  }
  if (row.status === "ready") {
    return <span className="enterprise-badge-success text-xs">Ready</span>;
  }
  if (row.status === "failed") {
    return (
      <span
        className="inline-flex items-center rounded-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--enterprise-semantic-danger-text)]"
        title={row.error ?? undefined}
      >
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-xs font-medium text-[var(--enterprise-primary-deep)]">
      Ready to upload
    </span>
  );
}

function UploadRowCard({
  row,
  onDiscipline,
  onRemove,
  onRetry,
}: {
  row: UploadRow;
  onDiscipline: (id: string, d: BuildingDiscipline) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const Icon = iconForKind(row.kind);
  return (
    <li className="mobile-list-row flex flex-col gap-3 border-b border-[var(--enterprise-border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-hover-surface)]">
          <Icon className={iconClassForKind(row.kind)} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--enterprise-text)]">
            {row.file.name}
          </p>
          <p className="enterprise-type-caption mt-0.5 text-[var(--enterprise-text-muted)]">
            {kindLabel(row.kind)} · {formatBytes(row.file.size)}
            {row.path.length > 1 ? ` · ${row.path.slice(0, -1).join(" / ")}` : ""}
          </p>
          {row.status === "uploading" ? (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--enterprise-hover-surface)]"
              role="progressbar"
              aria-valuenow={row.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-[var(--enterprise-primary)] transition-[width] duration-150"
                style={{ width: `${row.progress}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="shrink-0 sm:hidden">
          <StatusBadge row={row} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:w-auto">
        <label className="sr-only" htmlFor={`discipline-${row.id}`}>
          Discipline for {row.file.name}
        </label>
        <select
          id={`discipline-${row.id}`}
          className={`${MOBILE_FIELD_SELECT} min-w-0 flex-1 sm:w-40`}
          value={row.discipline ?? ""}
          disabled={row.status !== "queued"}
          onChange={(e) => onDiscipline(row.id, (e.target.value || null) as BuildingDiscipline)}
        >
          {DISCIPLINES.map((d) => (
            <option key={String(d.value)} value={d.value ?? ""}>
              {d.label}
            </option>
          ))}
        </select>
        <div className="hidden shrink-0 sm:block">
          <StatusBadge row={row} />
        </div>
        {row.status === "failed" ? (
          <button
            type="button"
            className="mobile-touch-target shrink-0 rounded-lg p-2 text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-primary-soft)]"
            aria-label={`Retry ${row.file.name}`}
            onClick={() => onRetry(row.id)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        ) : row.status === "queued" ? (
          <button
            type="button"
            className="mobile-touch-target shrink-0 rounded-lg p-2 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
            aria-label={`Remove ${row.file.name}`}
            onClick={() => onRemove(row.id)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

// fallow-ignore-next-line complexity
export function BuildingFileBrowser({
  open,
  onClose,
  buildingId,
  buildingName,
  projectId,
  locationId,
  workspaceId,
}: Props) {
  const [source, setSource] = useState<Source>("device");
  const batch = useBatchUpload({ buildingId, projectId, workspaceId, locationId });
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !batch.uploading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, batch.uploading]);

  useEffect(() => {
    if (batch.rows.length > prevCount.current && listRef.current) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCount.current = batch.rows.length;
  }, [batch.rows.length]);

  if (!open) return null;

  const handleFiles = (files: PickedFile[]) => {
    batch.addFiles(files);
  };

  const closeAndReset = () => {
    batch.clear();
    setSource("device");
    onClose();
  };

  const hasFiles = batch.rows.length > 0;
  const awaitingUpload = batch.queuedCount > 0 && !batch.uploading;
  const uploadDone = batch.allSettled && batch.queuedCount === 0;

  return (
    <div
      className="enterprise-animate-in fixed inset-0 z-50 flex flex-col bg-[var(--enterprise-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Add files to ${buildingName}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)]"
            aria-hidden
          >
            <Building2 className="h-5 w-5 text-[var(--enterprise-primary)]" />
          </div>
          <div className="min-w-0">
            <p className="enterprise-type-label text-[var(--enterprise-text-muted)]">Add files</p>
            <h2 className="truncate text-base font-semibold text-[var(--enterprise-text)]">
              {buildingName}
            </h2>
          </div>
        </div>
        <button
          type="button"
          className="mobile-touch-target rounded-lg p-2 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
          aria-label="Close"
          onClick={closeAndReset}
          disabled={batch.uploading}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          className="flex shrink-0 gap-1 border-b border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3"
          aria-label="File sources"
        >
          {[
            { id: "device" as const, label: "This device", icon: HardDrive },
            { id: "project" as const, label: "Project files", icon: FolderClosed },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`mobile-touch-target inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                source === id
                  ? "bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary-deep)]"
                  : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
              }`}
              onClick={() => setSource(id)}
              aria-pressed={source === id}
              disabled={batch.uploading}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div
          className={`relative min-h-0 flex-1 ${
            source === "device" && hasFiles
              ? "enterprise-scrollbar overflow-y-auto p-4 md:p-6"
              : "overflow-hidden"
          }`}
        >
          {source === "device" && !hasFiles ? (
            <div className="absolute inset-4 flex md:inset-6">
              <DeviceSource
                onFiles={handleFiles}
                title="Upload from this device"
                subtitle="Select IFC or PDF files, then upload them to this building."
              />
            </div>
          ) : null}

          {source === "device" && hasFiles ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <DeviceSource onFiles={handleFiles} compact />

              {awaitingUpload ? (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--enterprise-primary)]/25 bg-[var(--enterprise-primary-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--enterprise-primary-deep)]">
                      {batch.queuedCount} file{batch.queuedCount === 1 ? "" : "s"} ready — upload to
                      continue
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                      Files stay on your device until you upload.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="enterprise-btn-primary mobile-touch-target inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm shadow-sm"
                    onClick={() => void batch.startUpload()}
                  >
                    <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                    Upload {batch.queuedCount} file{batch.queuedCount === 1 ? "" : "s"}
                  </button>
                </div>
              ) : null}

              {uploadDone ? (
                <div
                  className="flex items-start gap-3 rounded-2xl border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] p-4"
                  role="status"
                >
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--enterprise-semantic-success-text)]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--enterprise-semantic-success-text)]">
                      Upload complete
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                      IFC and PDF files will keep processing in the background.
                    </p>
                  </div>
                </div>
              ) : null}

              <div
                ref={listRef}
                className="overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--enterprise-border)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--enterprise-text)]">
                    Selected files
                    <span className="ml-1.5 text-[var(--enterprise-text-muted)]">
                      ({batch.rows.length})
                    </span>
                  </p>
                  {!batch.uploading && batch.queuedCount > 0 ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-text)]"
                      onClick={() => batch.clear()}
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
                <ul className="divide-y-0">
                  {batch.rows.map((row) => (
                    <UploadRowCard
                      key={row.id}
                      row={row}
                      onDiscipline={batch.setRowDiscipline}
                      onRemove={batch.removeRow}
                      onRetry={(id) => void batch.retryRow(id)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {source === "project" ? (
            <div className="absolute inset-4 flex md:inset-6">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col">
                <ProjectFilesSource
                  projectId={projectId}
                  workspaceId={workspaceId}
                  buildingId={buildingId}
                  locationId={locationId}
                  onLinked={closeAndReset}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {source === "device" && hasFiles ? (
        <footer className="shrink-0 border-t border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-md md:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--enterprise-text-muted)]">
              {batch.uploading
                ? "Uploading… keep this window open"
                : uploadDone
                  ? `${batch.rows.length} file${batch.rows.length === 1 ? "" : "s"} uploaded`
                  : `${batch.queuedCount} of ${batch.rows.length} waiting to upload`}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {!batch.uploading ? (
                <button
                  type="button"
                  className="mobile-touch-target rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                  onClick={closeAndReset}
                >
                  {uploadDone ? "Close" : "Cancel"}
                </button>
              ) : null}
              {uploadDone ? (
                <button
                  type="button"
                  className="enterprise-btn-primary mobile-touch-target inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm"
                  onClick={closeAndReset}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  className="enterprise-btn-primary mobile-touch-target inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm disabled:opacity-50"
                  disabled={batch.queuedCount === 0 || batch.uploading}
                  onClick={() => void batch.startUpload()}
                >
                  {batch.uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                      Upload {batch.queuedCount} file{batch.queuedCount === 1 ? "" : "s"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

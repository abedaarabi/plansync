"use client";

import {
  CalendarClock,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Folder,
  LayoutGrid,
  List,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import type { CloudFile, Folder as ProjectFolder, Project } from "@/types/projects";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { isPdfFile } from "@/lib/isPdfFile";
import { PdfFileThumbnail } from "@/components/enterprise/PdfFileThumbnail";
import {
  countDirectChildren,
  fileExplorerDisplayName,
  formatBytes,
  formatItemDateOrDash,
  sortedVersions,
} from "./fileExplorerUtils";
import { FileExplorerEmptyState } from "./FileExplorerEmptyState";
import type { MoveDragPayload } from "@/store/uploadQueueStore";

export type FileExplorerContentProps = {
  project: Project;
  currentFolderId: string | null;
  subfolders: ProjectFolder[];
  files: CloudFile[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  searchQuery: string;
  selectedItemKey: string | null;
  onSelectItem: (key: string | null) => void;
  onOpenFolder: (id: string) => void;
  onOpenFile: (f: CloudFile) => void;
  onDeleteFolder: (f: ProjectFolder) => void;
  onDeleteFile: (f: CloudFile) => void;
  /** When set, grid/list show a download control for the selected revision. */
  onDownloadFile?: (f: CloudFile) => void;
  downloadingKey?: string | null;
  deletingKey: string | null;
  isDragOver: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  dropTargetKey?: string | null;
  onDragOverFolder?: (e: React.DragEvent<HTMLElement>, id: string) => void;
  onDragLeaveFolder?: (e: React.DragEvent<HTMLElement>, id: string) => void;
  onDropOnFolder?: (e: React.DragEvent<HTMLElement>, id: string) => void;
  uploadInputId: string;
  uploadDisabled?: boolean;
  onDragStartMove?: (e: React.DragEvent, payload: MoveDragPayload) => void;
  /** When set with `onFileVersionPick`, files with multiple versions show a revision selector for opening in the viewer. */
  fileVersionPick?: Record<string, number>;
  onFileVersionPick?: (fileId: string, version: number) => void;
};

function itemKeyForFolder(id: string) {
  return `folder:${id}` as const;
}
function itemKeyForFile(id: string) {
  return `file:${id}` as const;
}
function folderDropKey(id: string) {
  return `folder:${id}` as const;
}

export function FileExplorerContent({
  project,
  currentFolderId,
  subfolders,
  files,
  viewMode,
  onViewModeChange,
  searchQuery,
  selectedItemKey,
  onSelectItem,
  onOpenFolder,
  onOpenFile,
  onDeleteFolder,
  onDeleteFile,
  onDownloadFile,
  downloadingKey,
  deletingKey,
  isDragOver,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  dropTargetKey,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
  uploadInputId,
  uploadDisabled,
  onDragStartMove,
  fileVersionPick,
  onFileVersionPick,
}: FileExplorerContentProps) {
  const versionUi = Boolean(onFileVersionPick);

  function selectedVersionForFile(f: (typeof files)[0]) {
    const sv = sortedVersions(f);
    const fallback = sv[0]?.version ?? 1;
    const pick = fileVersionPick?.[f.id];
    if (pick != null && sv.some((x) => x.version === pick)) return pick;
    return fallback;
  }
  const direct = countDirectChildren(project, currentFolderId);
  const hasNoItems = subfolders.length === 0 && files.length === 0;
  const searchActive = searchQuery.trim().length > 0;
  const visibleCount = subfolders.length + files.length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 lg:px-6">
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          {searchActive ? (
            <>
              <span className="font-medium text-[var(--enterprise-text)]">
                {visibleCount} match{visibleCount === 1 ? "" : "es"}
              </span>
              <span className="text-slate-400"> in this folder ({direct.total} total)</span>
            </>
          ) : (
            <span className="font-medium text-[var(--enterprise-text)]">
              {direct.total} item{direct.total === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <div
          className="inline-flex rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 shadow-inner shadow-slate-200/20"
          role="group"
          aria-label="View layout"
        >
          <button
            type="button"
            title="Grid view"
            onClick={() => onViewModeChange("grid")}
            className={`rounded-md p-1.5 transition ${
              viewMode === "grid"
                ? "bg-white text-[var(--enterprise-primary)] shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="List view"
            onClick={() => onViewModeChange("list")}
            className={`rounded-md p-1.5 transition ${
              viewMode === "list"
                ? "bg-white text-[var(--enterprise-primary)] shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <List className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className={`relative min-h-0 flex-1 overflow-auto bg-slate-50 px-4 py-3.5 lg:px-6 ${
          isDragOver
            ? "bg-[var(--enterprise-primary-soft)]/60 ring-2 ring-inset ring-[var(--enterprise-primary)]/30"
            : ""
        } transition-colors`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isDragOver ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--enterprise-primary)]/50 bg-white/40 backdrop-blur-[1px]">
            <p className="text-sm font-semibold text-[var(--enterprise-primary-deep)]">
              Drop files here or onto a folder
            </p>
          </div>
        ) : null}

        {hasNoItems ? (
          searchActive ? (
            <FileExplorerEmptyState
              title="No matches"
              description="Try a different search term or clear the filter."
              uploadLabel=""
              variant="no-search-results"
            />
          ) : (
            <FileExplorerEmptyState
              title="No files yet"
              description="Upload files to get started, or add a folder from the toolbar."
              uploadLabel="Upload files"
              uploadDisabled={uploadDisabled}
              uploadInputId={uploadInputId}
            />
          )
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5 pb-3">
            {subfolders.map((fol) => {
              const inside = countDirectChildren(project, fol.id);
              const selected = selectedItemKey === itemKeyForFolder(fol.id);
              const dropTarget = dropTargetKey === folderDropKey(fol.id);
              return (
                <div
                  key={`folder-${fol.id}`}
                  onDragOver={onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined}
                  onDragLeave={onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined}
                  onDrop={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    selected
                      ? "border-[var(--enterprise-primary)]/40 ring-2 ring-[var(--enterprise-primary)]/25"
                      : "border-slate-200/90 hover:border-slate-300/90"
                  } ${dropTarget ? "border-[var(--enterprise-primary)]/45 ring-2 ring-[var(--enterprise-primary)]/35" : ""}`}
                >
                  <button
                    type="button"
                    draggable={Boolean(onDragStartMove)}
                    onDragStart={(e) => onDragStartMove?.(e, { kind: "folder", id: fol.id })}
                    onClick={() => {
                      onSelectItem(itemKeyForFolder(fol.id));
                      onOpenFolder(fol.id);
                    }}
                    className="flex cursor-pointer flex-col text-left"
                  >
                    <div className="relative flex aspect-[5/3] w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50/35">
                      <Folder
                        className="h-9 w-9 text-amber-500/95"
                        strokeWidth={1.25}
                        aria-hidden
                      />
                      <span className="mt-1.5 rounded-full bg-white/95 px-2 py-px text-[10px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                        {inside.total} item{inside.total !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/50 p-2.5">
                      <p className="truncate text-[13px] font-semibold leading-tight text-[var(--enterprise-text)]">
                        {fol.name}
                      </p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Folder
                      </p>
                      <div className="mt-2 space-y-1.5 border-t border-slate-100/90 pt-2">
                        <div className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                          <CalendarClock
                            className="mt-0.5 h-3 w-3 shrink-0 text-slate-400"
                            aria-hidden
                          />
                          <span>
                            <span className="text-slate-400">Created</span>{" "}
                            {formatItemDateOrDash(fol.createdAt ?? fol.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                          <Clock className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                          <span>
                            <span className="text-slate-400">Updated</span>{" "}
                            {formatItemDateOrDash(fol.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {dropTarget ? (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-blue-500/10">
                      <span className="rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-[var(--enterprise-primary-deep)] shadow-sm">
                        Drop to upload here
                      </span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="pointer-events-none absolute right-1.5 top-1.5 z-20 rounded-md bg-white/95 p-1 text-slate-400 opacity-0 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-red-50 hover:text-red-600 group-hover:pointer-events-auto group-hover:opacity-100"
                    disabled={deletingKey === `folder:${fol.id}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      void onDeleteFolder(fol);
                    }}
                    aria-label={`Delete ${fol.name}`}
                  >
                    {deletingKey === `folder:${fol.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
            {files.map((f) => {
              const sv = sortedVersions(f);
              const latest = sv[0];
              const displayVer = sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
              const size = displayVer ? formatBytes(displayVer.sizeBytes) : "—";
              const selected = selectedItemKey === itemKeyForFile(f.id);
              return (
                <div
                  key={f.id}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    selected
                      ? "border-[var(--enterprise-primary)]/40 ring-2 ring-[var(--enterprise-primary)]/25"
                      : "border-slate-200/90 hover:border-slate-300/90"
                  }`}
                >
                  <button
                    type="button"
                    draggable={Boolean(onDragStartMove)}
                    onDragStart={(e) => onDragStartMove?.(e, { kind: "file", id: f.id })}
                    onClick={() => {
                      onSelectItem(itemKeyForFile(f.id));
                      onOpenFile(f);
                    }}
                    className="flex cursor-pointer flex-col text-left"
                  >
                    <div className="relative aspect-[5/3] w-full overflow-hidden bg-slate-50">
                      <PdfFileThumbnail
                        fileId={f.id}
                        fileName={f.name}
                        mimeType={f.mimeType}
                        isPdf={isPdfFile(f)}
                        className="h-full w-full"
                      />
                      {isPdfFile(f) ? (
                        <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white/95 shadow-md ring-1 ring-slate-200/80">
                          <PdfFileIcon className="h-4 w-4" />
                        </div>
                      ) : null}
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-900/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1.5 text-[11px] font-semibold text-[var(--enterprise-text)] shadow-lg">
                          <Eye className="h-3 w-3" strokeWidth={2} />
                          Open
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/50 p-2.5">
                      <p className="truncate text-[13px] font-semibold leading-tight text-[var(--enterprise-text)]">
                        {fileExplorerDisplayName(f)}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {displayVer ? (
                          <>
                            <span className="font-medium text-slate-600">
                              {`Rev ${String.fromCharCode(64 + displayVer.version)} · v${displayVer.version}`}
                            </span>
                            <span className="text-slate-300"> · </span>
                            <span>{size}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                      <div className="mt-2 space-y-1.5 border-t border-slate-100/90 pt-2">
                        <div className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                          <Upload className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                          <span>
                            <span className="text-slate-400">Uploaded</span>{" "}
                            {formatItemDateOrDash(displayVer?.createdAt ?? f.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                          <Eye className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                          <span>
                            <span className="text-slate-400">Last opened</span>{" "}
                            {formatItemDateOrDash(f.lastOpenedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {versionUi && sv.length > 1 && onFileVersionPick ? (
                    <div
                      className="border-t border-slate-100 px-2 pb-2 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label
                        htmlFor={`file-version-${f.id}`}
                        className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-400"
                      >
                        Open revision
                      </label>
                      <select
                        id={`file-version-${f.id}`}
                        className="w-full rounded-md border border-slate-200/90 bg-white py-1 pl-1.5 pr-6 text-[10px] text-[var(--enterprise-text)] shadow-sm"
                        value={String(selectedVersionForFile(f))}
                        onChange={(e) => {
                          onFileVersionPick(f.id, Number(e.target.value));
                        }}
                        aria-label={`Revision for ${f.name}`}
                      >
                        {sv.map((ver) => (
                          <option key={ver.id} value={String(ver.version)}>
                            v{ver.version} ({formatBytes(ver.sizeBytes)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 flex gap-0.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                    {onDownloadFile ? (
                      <button
                        type="button"
                        className="pointer-events-auto rounded-md bg-white/95 p-1 text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-100 hover:text-slate-700"
                        disabled={downloadingKey === `file:${f.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDownloadFile(f);
                        }}
                        aria-label={`Download ${f.name}`}
                      >
                        {downloadingKey === `file:${f.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pointer-events-auto rounded-md bg-white/95 p-1 text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-red-50 hover:text-red-600"
                      disabled={deletingKey === `file:${f.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteFile(f);
                      }}
                      aria-label={`Delete ${f.name}`}
                    >
                      {deletingKey === `file:${f.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2.5 pl-4 pr-3" scope="col">
                    Name
                  </th>
                  <th className="w-[4.5rem] py-2.5 pr-3" scope="col">
                    Kind
                  </th>
                  <th className="min-w-[6.5rem] py-2.5 pr-3" scope="col">
                    Revision
                  </th>
                  <th className="min-w-[11rem] py-2.5 pr-3" scope="col">
                    Created / uploaded
                  </th>
                  <th className="min-w-[11rem] py-2.5 pr-3" scope="col">
                    Last opened
                  </th>
                  <th className="min-w-[4.5rem] py-2.5 pr-3" scope="col">
                    Size
                  </th>
                  <th className="min-w-[4.5rem] py-2.5 pr-4" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {subfolders.map((fol) => {
                  const inside = countDirectChildren(project, fol.id);
                  const selected = selectedItemKey === itemKeyForFolder(fol.id);
                  const dropTarget = dropTargetKey === folderDropKey(fol.id);
                  return (
                    <tr
                      key={`folder-row-${fol.id}`}
                      draggable={Boolean(onDragStartMove)}
                      onDragStart={(e) => {
                        if ((e.target as HTMLElement).closest('button[aria-label^="Delete"]')) {
                          e.preventDefault();
                          return;
                        }
                        onDragStartMove?.(e, { kind: "folder", id: fol.id });
                      }}
                      className={`cursor-pointer border-b border-slate-50 transition-colors last:border-b-0 ${
                        selected ? "bg-[var(--enterprise-primary-soft)]/80" : "hover:bg-slate-50/90"
                      } ${dropTarget ? "bg-blue-50/80" : ""}`}
                      onClick={() => {
                        onSelectItem(itemKeyForFolder(fol.id));
                        onOpenFolder(fol.id);
                      }}
                      onDragOver={onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined}
                      onDragLeave={
                        onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined
                      }
                      onDrop={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
                    >
                      <td className="py-2.5 pl-4">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--enterprise-text)]">
                          <Folder
                            className="h-3.5 w-3.5 shrink-0 text-amber-500"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          <span className="truncate">{fol.name}</span>
                          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">Folder</td>
                      <td className="py-2.5 text-slate-400">—</td>
                      <td className="py-2.5 text-slate-600">
                        {formatItemDateOrDash(fol.createdAt ?? fol.updatedAt)}
                      </td>
                      <td className="py-2.5 text-slate-400">—</td>
                      <td className="py-2.5 text-slate-500">
                        {inside.total} item{inside.total !== 1 ? "s" : ""}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          disabled={deletingKey === `folder:${fol.id}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            void onDeleteFolder(fol);
                          }}
                          aria-label={`Delete ${fol.name}`}
                        >
                          {deletingKey === `folder:${fol.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {files.map((f) => {
                  const sv = sortedVersions(f);
                  const latest = sv[0];
                  const displayVer =
                    sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
                  const selected = selectedItemKey === itemKeyForFile(f.id);
                  return (
                    <tr
                      key={f.id}
                      draggable={Boolean(onDragStartMove)}
                      onDragStart={(e) => {
                        if (
                          (e.target as HTMLElement).closest(
                            'button[aria-label^="Delete"], button[aria-label^="Download"]',
                          )
                        ) {
                          e.preventDefault();
                          return;
                        }
                        onDragStartMove?.(e, { kind: "file", id: f.id });
                      }}
                      className={`cursor-pointer border-b border-slate-50 transition-colors last:border-b-0 ${
                        selected ? "bg-[var(--enterprise-primary-soft)]/80" : "hover:bg-slate-50/90"
                      }`}
                      onClick={() => {
                        onSelectItem(itemKeyForFile(f.id));
                        onOpenFile(f);
                      }}
                    >
                      <td className="py-2.5 pl-4">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--enterprise-text)]">
                          {isPdfFile(f) ? (
                            <PdfFileIcon className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <FileText
                              className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          )}
                          {f.name}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">{isPdfFile(f) ? "PDF" : "File"}</td>
                      <td className="py-2.5 text-slate-600">
                        {versionUi && sv.length > 1 && onFileVersionPick ? (
                          <select
                            className="max-w-[140px] rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px] text-[var(--enterprise-text)]"
                            value={String(selectedVersionForFile(f))}
                            onClick={(ev) => ev.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              onFileVersionPick(f.id, Number(e.target.value));
                            }}
                            aria-label={`Revision for ${f.name}`}
                          >
                            {sv.map((ver) => (
                              <option key={ver.id} value={String(ver.version)}>
                                v{ver.version}
                              </option>
                            ))}
                          </select>
                        ) : latest ? (
                          <span className="text-slate-500">v{latest.version}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {formatItemDateOrDash(displayVer?.createdAt ?? f.updatedAt)}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {formatItemDateOrDash(f.lastOpenedAt)}
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {displayVer ? formatBytes(displayVer.sizeBytes) : "—"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {onDownloadFile ? (
                            <button
                              type="button"
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              disabled={downloadingKey === `file:${f.id}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void onDownloadFile(f);
                              }}
                              aria-label={`Download ${f.name}`}
                            >
                              {downloadingKey === `file:${f.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            disabled={deletingKey === `file:${f.id}`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void onDeleteFile(f);
                            }}
                            aria-label={`Delete ${f.name}`}
                          >
                            {deletingKey === `file:${f.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

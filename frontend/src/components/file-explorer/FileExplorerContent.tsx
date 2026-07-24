"use client";

import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Folder,
  LayoutGrid,
  List,
  Lock,
  Loader2,
  MessageSquare,
  Trash2,
  UserRound,
} from "lucide-react";
import type { CloudFile, Folder as ProjectFolder, Project } from "@/types/projects";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { isIfcFile, isPdfFile } from "@/lib/isPdfFile";
import { PdfFileThumbnail } from "@/components/enterprise/PdfFileThumbnail";
import {
  countDirectChildren,
  fileExplorerDisplayName,
  formatBytes,
  formatItemDateOrDash,
  sortedVersions,
} from "./fileExplorerUtils";
import { FileExplorerEmptyState } from "./FileExplorerEmptyState";
import { SwipeableListRow } from "@/components/mobile/SwipeableListRow";
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
  onOpenViewer?: (f: CloudFile) => void;
  onDeleteFolder: (f: ProjectFolder) => void;
  onDeleteFile: (f: CloudFile) => void;
  onDownloadFolder?: (f: ProjectFolder) => void;
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
  /** Cmd/Ctrl-click toggles IFC files for a federated BIM viewer session. */
  federationIfcIds?: Set<string>;
  onToggleFederationIfc?: (file: CloudFile) => void;
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
  onOpenViewer,
  onDeleteFolder,
  onDeleteFile,
  onDownloadFolder,
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
  federationIfcIds,
  onToggleFederationIfc,
}: FileExplorerContentProps) {
  const versionUi = Boolean(onFileVersionPick);

  // fallow-ignore-next-line complexity
  function handleFileSelect(f: CloudFile, e?: React.MouseEvent | React.KeyboardEvent) {
    if (
      isIfcFile(f) &&
      onToggleFederationIfc &&
      ("metaKey" in (e ?? {}) || "ctrlKey" in (e ?? {})) &&
      ((e as React.MouseEvent)?.metaKey || (e as React.MouseEvent)?.ctrlKey)
    ) {
      onToggleFederationIfc(f);
      return;
    }
    onSelectItem(itemKeyForFile(f.id));
  }

  function fileRowSelected(f: CloudFile) {
    return selectedItemKey === itemKeyForFile(f.id) || Boolean(federationIfcIds?.has(f.id));
  }

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
  const visibleFolderCount = subfolders.length;
  const visibleFileCount = files.length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200/80 bg-white/90 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-7">
        <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="min-w-0 text-xs text-[var(--enterprise-text-muted)] sm:text-sm">
            {searchActive ? (
              <>
                <span className="font-medium text-[var(--enterprise-text)]">
                  {visibleCount} match{visibleCount === 1 ? "" : "es"}
                </span>
                <span className="text-slate-400"> · {direct.total} total</span>
              </>
            ) : (
              <span className="font-medium text-[var(--enterprise-text)]">
                {direct.total} item{direct.total === 1 ? "" : "s"}
              </span>
            )}
          </p>
          <span className="hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:text-xs">
            {visibleFolderCount} folder{visibleFolderCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:text-xs">
            {visibleFileCount} file{visibleFileCount === 1 ? "" : "s"}
          </span>
        </div>
        <div
          className="inline-flex shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 shadow-inner shadow-slate-200/20"
          role="group"
          aria-label="View layout"
        >
          <button
            type="button"
            title="Grid view"
            onClick={() => onViewModeChange("grid")}
            className={`hidden min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 transition sm:inline-flex ${
              viewMode === "grid"
                ? "bg-white text-[var(--enterprise-primary)] shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="List view"
            onClick={() => onViewModeChange("list")}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 transition ${
              viewMode === "list"
                ? "bg-white text-[var(--enterprise-primary)] shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <List className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className={`mobile-scroll relative min-h-0 flex-1 overflow-auto bg-slate-50/90 px-0 py-0 sm:px-4 sm:py-4 lg:px-7 ${
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
          <div className="grid grid-cols-1 gap-2.5 pb-4 min-[420px]:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
            {subfolders.map((fol) => {
              const inside = countDirectChildren(project, fol.id);
              const selected = selectedItemKey === itemKeyForFolder(fol.id);
              const dropTarget = dropTargetKey === folderDropKey(fol.id);
              const folderLastOpenedIso = project.files
                .filter((file) => file.folderId === fol.id && file.lastOpenedAt)
                .map((file) => file.lastOpenedAt as string)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
              return (
                <div
                  key={`folder-${fol.id}`}
                  onDragOver={onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined}
                  onDragLeave={onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined}
                  onDrop={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
                  className={`group relative flex flex-col overflow-hidden rounded-lg border bg-slate-50/75 shadow-sm transition-all duration-200 sm:rounded-xl sm:hover:-translate-y-0.5 sm:hover:shadow-md ${
                    selected
                      ? "border-[var(--enterprise-primary)]/40 ring-2 ring-[var(--enterprise-primary)]/25"
                      : "border-slate-200/90 hover:border-[var(--enterprise-primary)]/35"
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
                    <div className="relative flex aspect-square w-full flex-col items-center justify-center bg-gradient-to-br from-[var(--enterprise-primary-soft)]/80 to-sky-50/80 sm:aspect-[5/3]">
                      <Folder
                        className="h-10 w-10 fill-current text-[var(--enterprise-primary)] sm:h-11 sm:w-11"
                        strokeWidth={1.35}
                        aria-hidden
                      />
                      <span className="mt-1 rounded-full bg-white/95 px-1.5 py-px text-[9px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80 sm:mt-1.5 sm:px-2 sm:text-[10px]">
                        {inside.total} item{inside.total !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="border-t border-slate-100/80 bg-transparent p-1.5 sm:p-2">
                      <p className="truncate text-[10px] font-normal leading-tight text-[var(--enterprise-text)] sm:text-[13px] sm:leading-tight">
                        {fol.name}
                        {fol.canAccess === false ? (
                          <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--enterprise-primary)]/80 sm:mt-1 sm:text-[10px]">
                        Folder
                      </p>
                      <div className="mt-1.5 space-y-1 rounded-md border border-slate-200/80 bg-white/80 px-2 py-1.5">
                        <p className="inline-flex items-center gap-1 text-[9px] text-slate-500 sm:text-[10px]">
                          <CalendarDays className="h-3 w-3" aria-hidden />
                          Created {formatItemDateOrDash(fol.createdAt)}
                        </p>
                        <p className="inline-flex items-center gap-1 text-[9px] text-slate-500 sm:text-[10px]">
                          <Clock3 className="h-3 w-3" aria-hidden />
                          Last open {formatItemDateOrDash(fol.lastOpenedAt ?? folderLastOpenedIso)}
                        </p>
                        <p className="inline-flex items-center gap-1 text-[9px] text-slate-500 sm:text-[10px]">
                          <UserRound className="h-3 w-3" aria-hidden />
                          Who: {fol.lastOpenedBy || "—"}
                        </p>
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
                  <div className="pointer-events-none absolute right-1 top-1 z-20 flex gap-0.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100 sm:right-1.5 sm:top-1.5">
                    {onDownloadFolder ? (
                      <button
                        type="button"
                        className="pointer-events-auto rounded-md bg-white/95 p-1 text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-100 hover:text-slate-700"
                        disabled={downloadingKey === `folder-download:${fol.id}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDownloadFolder(fol);
                        }}
                        aria-label={`Download ${fol.name}`}
                      >
                        {downloadingKey === `folder-download:${fol.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pointer-events-auto rounded-md bg-white/95 p-1 text-slate-400 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-red-50 hover:text-red-600"
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
                </div>
              );
            })}
            {files.map((f) => {
              const sv = sortedVersions(f);
              const latest = sv[0];
              const displayVer = sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
              const size = displayVer ? formatBytes(displayVer.sizeBytes) : "—";
              const selected = fileRowSelected(f);
              return (
                <div
                  key={f.id}
                  className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-200 sm:rounded-xl sm:hover:-translate-y-0.5 sm:hover:shadow-md ${
                    selected
                      ? federationIfcIds?.has(f.id)
                        ? "border-emerald-500/40 ring-2 ring-emerald-500/25"
                        : "border-[var(--enterprise-primary)]/40 ring-2 ring-[var(--enterprise-primary)]/25"
                      : "border-slate-200/90 hover:border-slate-300/90"
                  }`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    draggable={Boolean(onDragStartMove)}
                    onDragStart={(e) => onDragStartMove?.(e, { kind: "file", id: f.id })}
                    onClick={(e) => handleFileSelect(f, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleFileSelect(f, e);
                      }
                    }}
                    className="flex cursor-pointer flex-col text-left"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-50 sm:aspect-[5/3]">
                      <PdfFileThumbnail
                        fileId={f.id}
                        fileName={f.name}
                        mimeType={f.mimeType}
                        fileVersionId={displayVer?.id ?? null}
                        isPdf={isPdfFile(f)}
                        className="h-full w-full"
                      />
                      {(f.commentCount ?? 0) > 0 ? (
                        <div className="pointer-events-none absolute left-1 top-1 z-10 sm:left-1.5 sm:top-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--enterprise-primary)] px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm ring-1 ring-white/85 sm:text-[10px]">
                            <MessageSquare className="h-3 w-3" aria-hidden />
                            {f.commentCount}
                          </span>
                        </div>
                      ) : null}
                      {isPdfFile(f) || isIfcFile(f) ? (
                        <div className="pointer-events-none absolute bottom-1 left-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/95 shadow-md ring-1 ring-slate-200/80 sm:bottom-1.5 sm:left-1.5 sm:h-7 sm:w-7">
                          {isPdfFile(f) ? (
                            <PdfFileIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <IfcFileIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/50 p-1.5 sm:p-2.5">
                      <p className="truncate text-[10px] font-normal leading-tight text-[var(--enterprise-text)] sm:text-[13px] sm:leading-tight">
                        {fileExplorerDisplayName(f)}
                      </p>
                      <p className="mt-0.5 truncate text-[8px] text-slate-500 sm:mt-1 sm:text-[10px]">
                        {displayVer ? (
                          <>
                            <span className="font-medium text-slate-600">
                              {`Rev ${displayVer.version} · v${displayVer.version}`}
                            </span>
                            <span className="text-slate-300"> · </span>
                            <span>{size}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                      {(f.disciplines ?? []).length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(f.disciplines ?? []).slice(0, 2).map((discipline) => (
                            <span
                              key={`${f.id}-${discipline}`}
                              className="enterprise-badge-info rounded-md px-1.5 py-0.5 text-[9px]"
                            >
                              {discipline}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100/90 pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!onOpenViewer) return;
                            onOpenViewer(f);
                          }}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-normal text-[var(--enterprise-text)] transition hover:bg-slate-50 disabled:opacity-50 sm:text-[11px]"
                          disabled={!onOpenViewer}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Open file
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenFile(f);
                          }}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-normal text-[var(--enterprise-text)] transition hover:bg-slate-50 sm:text-[11px]"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                  {versionUi && sv.length > 1 && onFileVersionPick ? (
                    <div
                      className="border-t border-slate-100 px-1.5 pb-1.5 pt-1 sm:px-2 sm:pb-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label
                        htmlFor={`file-version-${f.id}`}
                        className="mb-0.5 block text-[8px] font-medium uppercase tracking-wide text-slate-400 sm:text-[9px]"
                      >
                        Open revision
                      </label>
                      <select
                        id={`file-version-${f.id}`}
                        className="w-full rounded-md border border-slate-200/90 bg-white py-0.5 pl-1 pr-5 text-[9px] text-[var(--enterprise-text)] shadow-sm sm:py-1 sm:pl-1.5 sm:pr-6 sm:text-[10px]"
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
                  <div className="absolute right-1 top-1 z-20 sm:right-1.5 sm:top-1.5">
                    <button
                      type="button"
                      className="rounded-md bg-white/95 p-1 text-slate-500 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-red-50 hover:text-red-600"
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
          <>
            <div className="overflow-hidden rounded-none border-0 bg-white shadow-none ring-0 xl:hidden">
              <ul className="divide-y divide-slate-100">
                {subfolders.map((fol) => {
                  const inside = countDirectChildren(project, fol.id);
                  const selected = selectedItemKey === itemKeyForFolder(fol.id);
                  const dropTarget = dropTargetKey === folderDropKey(fol.id);
                  const folderLastOpenedIso = project.files
                    .filter((file) => file.folderId === fol.id && file.lastOpenedAt)
                    .map((file) => file.lastOpenedAt as string)
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
                  return (
                    <li key={`m-folder-${fol.id}`}>
                      <SwipeableListRow
                        onTap={() => {
                          onSelectItem(itemKeyForFolder(fol.id));
                          onOpenFolder(fol.id);
                        }}
                        actions={[
                          ...(onDownloadFolder
                            ? [
                                {
                                  id: "download",
                                  label: "Download",
                                  icon: <Download className="h-4 w-4" aria-hidden />,
                                  onAction: () => onDownloadFolder(fol),
                                },
                              ]
                            : []),
                          {
                            id: "delete",
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" aria-hidden />,
                            onAction: () => void onDeleteFolder(fol),
                          },
                        ]}
                      >
                        <div
                          draggable={Boolean(onDragStartMove)}
                          onDragStart={(e) => {
                            if ((e.target as HTMLElement).closest("button")) {
                              e.preventDefault();
                              return;
                            }
                            onDragStartMove?.(e, { kind: "folder", id: fol.id });
                          }}
                          onDragOver={
                            onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined
                          }
                          onDragLeave={
                            onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined
                          }
                          onDrop={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
                          className={`mobile-list-row flex w-full items-center gap-2.5 py-2.5 text-left transition-colors duration-150 ${
                            selected ? "bg-[var(--enterprise-primary-soft)]/80" : ""
                          } ${dropTarget ? "bg-blue-50/80" : ""}`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--enterprise-primary-soft)]/80 to-sky-50/70 ring-1 ring-[var(--enterprise-primary)]/20">
                            <Folder
                              className="h-7 w-7 fill-current text-[var(--enterprise-primary)]"
                              strokeWidth={1.4}
                              aria-hidden
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="inline-flex items-center gap-1 truncate text-[13px] font-normal text-[var(--enterprise-text)] sm:text-base">
                              <span className="truncate">{fol.name}</span>
                              {fol.canAccess === false ? (
                                <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              ) : null}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 sm:text-sm">
                              {fol.canAccess === false
                                ? "Restricted folder · request access"
                                : `Folder · ${inside.total} item${inside.total !== 1 ? "s" : ""}`}
                            </p>
                            <p className="mt-0.5 inline-flex max-w-full items-center gap-1.5 overflow-hidden text-[10px] text-slate-500 sm:mt-1 sm:text-xs">
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                                Last open{" "}
                                {formatItemDateOrDash(fol.lastOpenedAt ?? folderLastOpenedIso)}
                              </span>
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <UserRound className="h-3.5 w-3.5" aria-hidden />
                                Who {fol.lastOpenedBy || "—"}
                              </span>
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                        </div>
                      </SwipeableListRow>
                    </li>
                  );
                })}
                {files.map((f) => {
                  const sv = sortedVersions(f);
                  const latest = sv[0];
                  const displayVer =
                    sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
                  const selected = fileRowSelected(f);
                  return (
                    <li key={`m-file-${f.id}`}>
                      <SwipeableListRow
                        onTap={() => {
                          handleFileSelect(f);
                          onOpenFile(f);
                        }}
                        actions={[
                          {
                            id: "delete",
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" aria-hidden />,
                            onAction: () => void onDeleteFile(f),
                          },
                        ]}
                      >
                        <div
                          draggable={Boolean(onDragStartMove)}
                          onDragStart={(e) => {
                            if ((e.target as HTMLElement).closest("button, select")) {
                              e.preventDefault();
                              return;
                            }
                            onDragStartMove?.(e, { kind: "file", id: f.id });
                          }}
                          className={`mobile-list-row flex w-full items-center gap-2.5 py-2.5 text-left transition-colors duration-150 ${
                            selected
                              ? federationIfcIds?.has(f.id)
                                ? "bg-emerald-50/90"
                                : "bg-[var(--enterprise-primary-soft)]/80"
                              : ""
                          }`}
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/60">
                            <PdfFileThumbnail
                              fileId={f.id}
                              fileName={f.name}
                              mimeType={f.mimeType}
                              fileVersionId={displayVer?.id ?? null}
                              isPdf={isPdfFile(f)}
                              className="h-full w-full"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-normal text-[var(--enterprise-text)] sm:text-base">
                              {fileExplorerDisplayName(f)}
                            </p>
                            <p className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-slate-500 sm:text-sm">
                              {displayVer ? `Rev ${displayVer.version}` : "—"}
                              {(f.commentCount ?? 0) > 0 ? (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="inline-flex items-center gap-1 font-medium text-[var(--enterprise-primary)]">
                                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                                    {f.commentCount}
                                  </span>
                                </>
                              ) : null}
                            </p>
                            <div className="mt-1 flex gap-1">
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (!onOpenViewer) return;
                                  onOpenViewer(f);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-normal text-[var(--enterprise-text)]"
                                disabled={!onOpenViewer}
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden />
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onOpenFile(f);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-normal text-[var(--enterprise-text)]"
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                Details
                              </button>
                            </div>
                            {versionUi && sv.length > 1 && onFileVersionPick ? (
                              <select
                                className="mt-1 h-8 rounded-md border border-slate-200/90 bg-white px-2 text-xs text-[var(--enterprise-text)]"
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
                                    Rev {ver.version}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                        </div>
                      </SwipeableListRow>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5 xl:block">
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
                    const folderLastOpenedIso = project.files
                      .filter((file) => file.folderId === fol.id && file.lastOpenedAt)
                      .map((file) => file.lastOpenedAt as string)
                      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
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
                          selected
                            ? "bg-[var(--enterprise-primary-soft)]/80"
                            : "hover:bg-slate-50/90"
                        } ${dropTarget ? "bg-blue-50/80" : ""}`}
                        onClick={() => {
                          onSelectItem(itemKeyForFolder(fol.id));
                          onOpenFolder(fol.id);
                        }}
                        onDragOver={
                          onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined
                        }
                        onDragLeave={
                          onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined
                        }
                        onDrop={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
                      >
                        <td className="py-2.5 pl-4">
                          <span className="inline-flex items-center gap-1.5 font-normal text-[var(--enterprise-text)]">
                            <Folder
                              className="h-4 w-4 shrink-0 fill-current text-[var(--enterprise-primary)]"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                            <span className="inline-flex items-center gap-1 truncate">
                              <span className="truncate">{fol.name}</span>
                              {fol.canAccess === false ? (
                                <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                              ) : null}
                            </span>
                            <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-500">Folder</td>
                        <td className="py-2.5 text-slate-600">
                          <div className="space-y-0.5">
                            <p>{formatItemDateOrDash(fol.lastOpenedAt ?? folderLastOpenedIso)}</p>
                            <p className="text-xs text-slate-500">Who: {fol.lastOpenedBy || "—"}</p>
                          </div>
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {formatItemDateOrDash(fol.createdAt ?? fol.updatedAt)}
                        </td>
                        <td className="py-2.5 text-slate-400">—</td>
                        <td className="py-2.5 text-slate-500">
                          {inside.total} item{inside.total !== 1 ? "s" : ""}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-0.5">
                            {onDownloadFolder ? (
                              <button
                                type="button"
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                disabled={downloadingKey === `folder-download:${fol.id}`}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onDownloadFolder(fol);
                                }}
                                aria-label={`Download ${fol.name}`}
                              >
                                {downloadingKey === `folder-download:${fol.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </button>
                            ) : null}
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {files.map((f) => {
                    const sv = sortedVersions(f);
                    const latest = sv[0];
                    const displayVer =
                      sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
                    const selected = fileRowSelected(f);
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
                          selected
                            ? federationIfcIds?.has(f.id)
                              ? "bg-emerald-50/90"
                              : "bg-[var(--enterprise-primary-soft)]/80"
                            : "hover:bg-slate-50/90"
                        }`}
                        onClick={(e) => {
                          const federationToggle =
                            isIfcFile(f) && onToggleFederationIfc && (e.metaKey || e.ctrlKey);
                          handleFileSelect(f, e);
                          if (!federationToggle) onOpenFile(f);
                        }}
                      >
                        <td className="py-2.5 pl-4">
                          <span className="inline-flex items-center gap-1.5 font-normal text-[var(--enterprise-text)]">
                            {isPdfFile(f) ? (
                              <PdfFileIcon className="h-3.5 w-3.5 shrink-0" />
                            ) : isIfcFile(f) ? (
                              <IfcFileIcon className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <FileText
                                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            )}
                            <span className="truncate">{f.name}</span>
                            {(f.commentCount ?? 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--enterprise-primary)]">
                                <MessageSquare className="h-3 w-3" aria-hidden />
                                {f.commentCount}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {isPdfFile(f) ? "PDF" : isIfcFile(f) ? "IFC" : "File"}
                        </td>
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-normal text-[var(--enterprise-text)] hover:bg-slate-50 disabled:opacity-50"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (!onOpenViewer) return;
                                onOpenViewer(f);
                              }}
                              disabled={!onOpenViewer}
                              aria-label={`Open ${f.name}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Open
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-normal text-[var(--enterprise-text)] hover:bg-slate-50"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onOpenFile(f);
                              }}
                              aria-label={`Open details for ${f.name}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Details
                            </button>
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
          </>
        )}
      </div>
    </div>
  );
}

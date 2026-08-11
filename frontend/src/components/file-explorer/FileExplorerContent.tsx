"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Folder,
  Info,
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
import { ifcStatusSpinning, type IfcModelUiStatus } from "@/lib/bim/ifcModelStatus";
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
import { folderPathLabel } from "@/lib/folderPathLabel";
import type { MoveDragPayload } from "@/store/uploadQueueStore";

function SearchPathHint({ path }: { path: string }) {
  return (
    <p className="enterprise-type-caption mt-0.5 truncate" title={path}>
      {path}
    </p>
  );
}

function latestFolderOpenFromFiles(project: Project, folderId: string): string | undefined {
  return project.files
    .filter((file) => file.folderId === folderId && file.lastOpenedAt)
    .map((file) => file.lastOpenedAt as string)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

export type FileExplorerContentProps = {
  project: Project;
  currentFolderId: string | null;
  subfolders: ProjectFolder[];
  files: CloudFile[];
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  searchQuery: string;
  /** When set, replaces the default item-count caption (e.g. overview kind filter). */
  listScopeHint?: string;
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
  /** Published IFC badge label, e.g. "3 levels · 12 sheets". */
  ifcPublishBadge?: (file: CloudFile) => string | null;
  /** Rich IFC processing / publish status for badges and spinners. */
  ifcModelStatus?: (file: CloudFile) => IfcModelUiStatus | null;
  onPublishIfcModel?: (file: CloudFile) => void;
  onLoadIfcPublishMeta?: (file: CloudFile) => void;
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

function folderListMeta(
  project: Project,
  fol: ProjectFolder,
  selectedItemKey: string | null,
  dropTargetKey: string | null | undefined,
) {
  return {
    inside: countDirectChildren(project, fol.id),
    selected: selectedItemKey === itemKeyForFolder(fol.id),
    dropTarget: dropTargetKey === folderDropKey(fol.id),
    folderLastOpenedIso: latestFolderOpenFromFiles(project, fol.id),
  };
}

// fallow-ignore-next-line complexity
export function FileExplorerContent({
  project,
  currentFolderId,
  subfolders,
  files,
  viewMode,
  onViewModeChange,
  searchQuery,
  listScopeHint,
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
  ifcPublishBadge,
  ifcModelStatus,
  onPublishIfcModel,
  onLoadIfcPublishMeta: _onLoadIfcPublishMeta,
}: FileExplorerContentProps) {
  const versionUi = Boolean(onFileVersionPick);
  /** HTML5 drag steals taps on iOS/Android — only enable on fine pointers. */
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const canDragItems = Boolean(onDragStartMove) && finePointer;

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

  // fallow-ignore-next-line complexity
  function renderIfcActions(f: CloudFile, compact?: boolean) {
    if (!isIfcFile(f)) return null;
    const uiStatus = ifcModelStatus?.(f);
    const badge = uiStatus?.label ?? ifcPublishBadge?.(f);
    const spinning = ifcStatusSpinning(uiStatus);
    const btnClass = compact
      ? "rounded-md border border-[var(--enterprise-border)] px-1.5 py-1 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
      : "inline-flex items-center gap-1 rounded-md border border-[var(--enterprise-border)] px-2 py-1 text-xs font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]";
    const badgeClass =
      uiStatus?.kind === "failed"
        ? "enterprise-badge-danger"
        : uiStatus?.kind === "ready_to_publish"
          ? "enterprise-badge-warning"
          : spinning
            ? "enterprise-badge-info"
            : "enterprise-badge-info";
    return (
      <div className={`flex flex-wrap items-center gap-1 ${compact ? "mt-1.5" : ""}`}>
        {badge ? (
          <span
            className={`${badgeClass} inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] sm:text-xs`}
          >
            {spinning ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {badge}
          </span>
        ) : null}
        {onPublishIfcModel && (uiStatus?.kind === "ready_to_publish" || !badge) ? (
          <button
            type="button"
            className={btnClass}
            onClick={(e) => {
              e.stopPropagation();
              onPublishIfcModel(f);
            }}
          >
            Publish model
          </button>
        ) : null}
      </div>
    );
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
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/90 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-7">
        <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="min-w-0 text-xs text-[var(--enterprise-text-muted)] sm:text-sm">
            {listScopeHint ? (
              <>
                <span className="font-medium text-[var(--enterprise-text)]">
                  {searchActive
                    ? `${visibleCount} match${visibleCount === 1 ? "" : "es"}`
                    : `${visibleFileCount} file${visibleFileCount === 1 ? "" : "s"}`}
                </span>
                <span className="text-[var(--enterprise-text-muted)]"> · {listScopeHint}</span>
              </>
            ) : searchActive ? (
              <>
                <span className="font-medium text-[var(--enterprise-text)]">
                  {visibleCount} match{visibleCount === 1 ? "" : "es"}
                </span>
                <span className="text-[var(--enterprise-text-muted)]"> · {direct.total} total</span>
              </>
            ) : (
              <span className="font-medium text-[var(--enterprise-text)]">
                {direct.total} item{direct.total === 1 ? "" : "s"}
              </span>
            )}
          </p>
          {!listScopeHint ? (
            <>
              <span
                className="hidden h-4 w-px bg-[var(--enterprise-border)] sm:inline"
                aria-hidden
              />
              <span className="rounded-md bg-[var(--enterprise-bg)] px-2 py-0.5 text-xs font-medium text-[var(--enterprise-text-muted)] sm:text-xs">
                {visibleFolderCount} folder{visibleFolderCount === 1 ? "" : "s"}
              </span>
              <span className="rounded-md bg-[var(--enterprise-bg)] px-2 py-0.5 text-xs font-medium text-[var(--enterprise-text-muted)] sm:text-xs">
                {visibleFileCount} file{visibleFileCount === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>
        <div
          className="inline-flex shrink-0 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] p-0.5"
          role="group"
          aria-label="View layout"
        >
          <button
            type="button"
            title="Grid view"
            onClick={() => onViewModeChange("grid")}
            className={`hidden min-h-11 min-w-11 items-center justify-center rounded-md p-1.5 transition lg:inline-flex ${
              viewMode === "grid"
                ? "bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)]"
                : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-subtitle)]"
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
                ? "bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)]"
                : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-subtitle)]"
            }`}
          >
            <List className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className={`mobile-scroll relative min-h-0 flex-1 overflow-auto bg-[var(--enterprise-bg)] px-0 py-0 sm:px-4 sm:py-4 lg:px-7 ${
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
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--enterprise-primary)]/50 bg-[var(--enterprise-surface)]/70 ">
            <p className="text-sm font-semibold text-[var(--enterprise-primary-deep)]">
              Drop files here or onto a folder
            </p>
          </div>
        ) : null}

        {hasNoItems ? (
          searchActive ? (
            <FileExplorerEmptyState
              title="No matches"
              description="Search looks in this folder and all subfolders. Try another term or clear the search."
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
          <div className="space-y-2.5 pb-4">
            {subfolders.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
                {subfolders.map((fol) => {
                  const inside = countDirectChildren(project, fol.id);
                  const selected = selectedItemKey === itemKeyForFolder(fol.id);
                  const dropTarget = dropTargetKey === folderDropKey(fol.id);
                  const folderLastOpenedIso = latestFolderOpenFromFiles(project, fol.id);
                  const lastOpenedLabel = formatItemDateOrDash(
                    fol.lastOpenedAt ?? folderLastOpenedIso,
                  );
                  return (
                    <div
                      key={`folder-${fol.id}`}
                      onDragOver={onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined}
                      onDragLeave={
                        onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined
                      }
                      onDrop={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
                      className={`group relative overflow-hidden rounded-lg border bg-[var(--enterprise-surface)] transition hover:border-[var(--enterprise-primary)]/30 hover:${
                        selected
                          ? "border-[var(--enterprise-primary)]/45 ring-2 ring-[var(--enterprise-primary)]/20"
                          : "border-[var(--enterprise-border)]"
                      } ${
                        dropTarget
                          ? "border-[var(--enterprise-primary)]/45 ring-2 ring-[var(--enterprise-primary)]/35"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        draggable={canDragItems}
                        onDragStart={(e) => onDragStartMove?.(e, { kind: "folder", id: fol.id })}
                        onClick={() => {
                          onSelectItem(itemKeyForFolder(fol.id));
                          onOpenFolder(fol.id);
                        }}
                        className="flex w-full min-h-11 cursor-pointer items-center gap-2 px-2 py-2 text-left"
                      >
                        <Folder
                          className="h-7 w-7 shrink-0 fill-current text-[var(--enterprise-primary)]"
                          strokeWidth={1.4}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="truncate text-xs font-medium leading-tight text-[var(--enterprise-text)]">
                              {fol.name}
                            </span>
                            {fol.canAccess === false ? (
                              <Lock
                                className="h-3 w-3 shrink-0 text-[var(--enterprise-text-muted)]"
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          {searchActive ? (
                            <SearchPathHint path={folderPathLabel(project.folders, fol.parentId)} />
                          ) : null}
                          <span className="mt-0.5 block truncate text-xs leading-tight text-[var(--enterprise-text-muted)]">
                            {inside.total} item{inside.total !== 1 ? "s" : ""}
                            {" · "}
                            {lastOpenedLabel}
                          </span>
                          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-tight text-[var(--enterprise-text-muted)]">
                            <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{fol.lastOpenedBy?.trim() || "—"}</span>
                          </span>
                        </span>
                        <ChevronRight
                          className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] opacity-50"
                          aria-hidden
                        />
                      </button>
                      {dropTarget ? (
                        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10">
                          <span className="rounded-md bg-[var(--enterprise-surface)]/95 px-2 py-1 text-xs font-semibold text-[var(--enterprise-primary-deep)]">
                            Drop here
                          </span>
                        </div>
                      ) : null}
                      <div className="pointer-events-none absolute right-1.5 top-1.5 z-20 hidden opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 lg:block">
                        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--enterprise-surface)]/92 p-0.5 ">
                          {onDownloadFolder ? (
                            <button
                              type="button"
                              className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                              disabled={downloadingKey === `folder-download:${fol.id}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onDownloadFolder(fol);
                              }}
                              aria-label={`Download ${fol.name}`}
                            >
                              {downloadingKey === `folder-download:${fol.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                              ) : (
                                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                            disabled={deletingKey === `folder:${fol.id}`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void onDeleteFolder(fol);
                            }}
                            aria-label={`Delete ${fol.name}`}
                          >
                            {deletingKey === `folder:${fol.id}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] sm:gap-2 lg:grid-cols-[repeat(auto-fill,minmax(136px,1fr))]">
              {files.map(
                // fallow-ignore-next-line complexity, code-duplication
                (f) => {
                  const sv = sortedVersions(f);
                  const latest = sv[0];
                  const displayVer =
                    sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
                  const size = displayVer ? formatBytes(displayVer.sizeBytes) : "—";
                  const selected = fileRowSelected(f);
                  const disciplines = (f.disciplines ?? []).slice(0, 1);
                  return (
                    <div
                      key={f.id}
                      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-[var(--enterprise-surface)] transition duration-150 hover:border-[var(--enterprise-primary)]/30 hover:${
                        selected
                          ? federationIfcIds?.has(f.id)
                            ? "border-emerald-500/40 ring-2 ring-emerald-500/25"
                            : "border-[var(--enterprise-primary)]/45 ring-2 ring-[var(--enterprise-primary)]/20"
                          : "border-[var(--enterprise-border)]"
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        draggable={canDragItems}
                        onDragStart={(e) => onDragStartMove?.(e, { kind: "file", id: f.id })}
                        onClick={(e) => handleFileSelect(f, e)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (onOpenViewer) onOpenViewer(f);
                          else onOpenFile(f);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleFileSelect(f, e);
                          }
                        }}
                        className="flex cursor-pointer flex-col text-left"
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--enterprise-bg)]">
                          <PdfFileThumbnail
                            fileId={f.id}
                            fileName={f.name}
                            mimeType={f.mimeType}
                            fileVersionId={displayVer?.id ?? null}
                            isPdf={isPdfFile(f)}
                            className="h-full w-full"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
                          {(f.commentCount ?? 0) > 0 ? (
                            <div className="pointer-events-none absolute left-1.5 top-1.5 z-10">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--enterprise-primary)] px-1.5 py-0.5 text-xs font-semibold text-white">
                                <MessageSquare className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                                {f.commentCount}
                              </span>
                            </div>
                          ) : null}
                          {isPdfFile(f) || isIfcFile(f) ? (
                            <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 ">
                              {isPdfFile(f) ? (
                                <PdfFileIcon className="h-6 w-6 rounded-[5px]" />
                              ) : (
                                <span className="relative inline-flex">
                                  <IfcFileIcon className="h-6 w-6 rounded-[5px]" />
                                  {ifcStatusSpinning(ifcModelStatus?.(f)) ? (
                                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--enterprise-surface)] ring-1 ring-[var(--enterprise-border)]">
                                      <Loader2
                                        className="h-2.5 w-2.5 animate-spin text-[var(--enterprise-primary)]"
                                        aria-hidden
                                      />
                                    </span>
                                  ) : null}
                                </span>
                              )}
                            </div>
                          ) : null}
                          <div className="absolute bottom-1.5 right-1.5 z-20 opacity-100 transition duration-150 lg:translate-y-0.5 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100">
                            <div className="flex items-center gap-0.5 rounded-lg bg-[var(--enterprise-surface)]/92 p-0.5 ">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!onOpenViewer) return;
                                  onOpenViewer(f);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--enterprise-primary)] text-white transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50"
                                disabled={!onOpenViewer}
                                title="Open"
                                aria-label={`Open ${f.name}`}
                              >
                                <Eye className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenFile(f);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                                title="Details"
                                aria-label={`Open details for ${f.name}`}
                              >
                                <Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                              </button>
                            </div>
                          </div>
                          <div className="absolute right-1.5 top-1.5 z-20 opacity-100 transition duration-150 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--enterprise-surface)]/92 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                              disabled={deletingKey === `file:${f.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDeleteFile(f);
                              }}
                              aria-label={`Delete ${f.name}`}
                            >
                              {deletingKey === `file:${f.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-0.5 px-2 py-1.5">
                          <p
                            className="truncate text-xs font-medium leading-snug text-[var(--enterprise-text)]"
                            title={fileExplorerDisplayName(f)}
                          >
                            {fileExplorerDisplayName(f)}
                          </p>
                          {searchActive ? (
                            <SearchPathHint path={folderPathLabel(project.folders, f.folderId)} />
                          ) : null}
                          <p className="truncate text-xs leading-tight text-[var(--enterprise-text-muted)]">
                            {displayVer ? (
                              <>
                                <span className="tabular-nums">v{displayVer.version}</span>
                                <span className="mx-0.5 text-[var(--enterprise-border)]">·</span>
                                <span className="tabular-nums">{size}</span>
                              </>
                            ) : (
                              "—"
                            )}
                            {disciplines.length > 0 ? (
                              <>
                                <span className="mx-0.5 text-[var(--enterprise-border)]">·</span>
                                <span>{disciplines[0]}</span>
                              </>
                            ) : null}
                          </p>
                          {renderIfcActions(f, true)}
                        </div>
                      </div>
                      {versionUi && sv.length > 1 && onFileVersionPick ? (
                        <div
                          className="border-t border-[var(--enterprise-border)]/70 px-1.5 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            id={`file-version-${f.id}`}
                            className="w-full rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-0.5 pl-1.5 pr-5 text-xs text-[var(--enterprise-text)]"
                            value={String(selectedVersionForFile(f))}
                            onChange={(e) => {
                              onFileVersionPick(f.id, Number(e.target.value));
                            }}
                            aria-label={`Revision for ${f.name}`}
                          >
                            {sv.map((ver) => (
                              <option key={ver.id} value={String(ver.version)}>
                                v{ver.version} · {formatBytes(ver.sizeBytes)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-none border-0 bg-[var(--enterprise-surface)] shadow-none ring-0 lg:hidden">
              <ul className="divide-y divide-[var(--enterprise-border)]">
                {subfolders.map((fol) => {
                  const { inside, selected, dropTarget, folderLastOpenedIso } = folderListMeta(
                    project,
                    fol,
                    selectedItemKey,
                    dropTargetKey,
                  );
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
                          draggable={canDragItems}
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
                          <Folder
                            className="h-9 w-9 shrink-0 fill-current text-[var(--enterprise-primary)]"
                            strokeWidth={1.35}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="inline-flex items-center gap-1 truncate text-[13px] font-normal text-[var(--enterprise-text)] sm:text-base">
                              <span className="truncate">{fol.name}</span>
                              {fol.canAccess === false ? (
                                <Lock
                                  className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                                  aria-hidden
                                />
                              ) : null}
                            </p>
                            {searchActive ? (
                              <SearchPathHint
                                path={folderPathLabel(project.folders, fol.parentId)}
                              />
                            ) : null}
                            <p className="truncate text-xs text-[var(--enterprise-text-muted)] sm:text-sm">
                              {fol.canAccess === false
                                ? "Restricted folder · request access"
                                : `Folder · ${inside.total} item${inside.total !== 1 ? "s" : ""}`}
                            </p>
                            <p className="mt-0.5 inline-flex max-w-full items-center gap-1.5 overflow-hidden text-xs text-[var(--enterprise-text-muted)] sm:mt-1 sm:text-xs">
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                                Last open{" "}
                                {formatItemDateOrDash(fol.lastOpenedAt ?? folderLastOpenedIso)}
                              </span>
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <UserRound className="h-3.5 w-3.5" aria-hidden />
                                <span className="truncate">{fol.lastOpenedBy?.trim() || "—"}</span>
                              </span>
                            </p>
                          </div>
                          <ChevronRight
                            className="h-5 w-5 shrink-0 text-[var(--enterprise-border)]"
                            aria-hidden
                          />
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
                          draggable={canDragItems}
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
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--enterprise-hover-surface)] ring-1 ring-[var(--enterprise-border)]">
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
                            {searchActive ? (
                              <SearchPathHint path={folderPathLabel(project.folders, f.folderId)} />
                            ) : null}
                            <p className="inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--enterprise-text-muted)] sm:text-sm">
                              {displayVer ? `Rev ${displayVer.version}` : "—"}
                              {(f.commentCount ?? 0) > 0 ? (
                                <>
                                  <span className="text-[var(--enterprise-border)]">•</span>
                                  <span className="inline-flex items-center gap-1 font-medium text-[var(--enterprise-primary)]">
                                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                                    {f.commentCount}
                                  </span>
                                </>
                              ) : null}
                            </p>
                            <div className="mt-1 flex gap-0.5">
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (!onOpenViewer) return;
                                  onOpenViewer(f);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-50"
                                disabled={!onOpenViewer}
                                title="Open"
                                aria-label={`Open ${f.name}`}
                              >
                                <Eye className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onOpenFile(f);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                                title="Details"
                                aria-label={`Open details for ${f.name}`}
                              >
                                <FileText className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                            {versionUi && sv.length > 1 && onFileVersionPick ? (
                              <select
                                className="mt-1 h-8 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 text-xs text-[var(--enterprise-text)]"
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
                          <ChevronRight
                            className="h-5 w-5 shrink-0 text-[var(--enterprise-border)]"
                            aria-hidden
                          />
                        </div>
                      </SwipeableListRow>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="enterprise-scrollbar enterprise-card hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="enterprise-type-label border-b border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]">
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
                    const { inside, selected, dropTarget, folderLastOpenedIso } = folderListMeta(
                      project,
                      fol,
                      selectedItemKey,
                      dropTargetKey,
                    );
                    return (
                      <tr
                        key={`folder-row-${fol.id}`}
                        draggable={canDragItems}
                        onDragStart={(e) => {
                          if ((e.target as HTMLElement).closest('button[aria-label^="Delete"]')) {
                            e.preventDefault();
                            return;
                          }
                          onDragStartMove?.(e, { kind: "folder", id: fol.id });
                        }}
                        className={`cursor-pointer border-b border-[var(--enterprise-border-subtle)] transition-colors last:border-b-0 ${
                          selected
                            ? "bg-[var(--enterprise-primary-soft)]/80"
                            : "hover:bg-[var(--enterprise-bg)]"
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
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 font-normal text-[var(--enterprise-text)]">
                              <Folder
                                className="h-5 w-5 shrink-0 fill-current text-[var(--enterprise-primary)]"
                                strokeWidth={1.4}
                                aria-hidden
                              />
                              <span className="inline-flex items-center gap-1 truncate">
                                <span className="truncate font-normal">{fol.name}</span>
                                {fol.canAccess === false ? (
                                  <Lock
                                    className="h-3 w-3 shrink-0 text-[var(--enterprise-text-muted)]"
                                    aria-hidden
                                  />
                                ) : null}
                              </span>
                              <ChevronRight
                                className="h-3 w-3 shrink-0 text-[var(--enterprise-border)]"
                                aria-hidden
                              />
                            </span>
                            {searchActive ? (
                              <SearchPathHint
                                path={folderPathLabel(project.folders, fol.parentId)}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 text-[var(--enterprise-text-muted)]">Folder</td>
                        <td className="py-2.5 text-[var(--enterprise-text-muted)]">—</td>
                        <td className="py-2.5 text-[var(--enterprise-subtitle)]">
                          {formatItemDateOrDash(fol.createdAt ?? fol.updatedAt)}
                        </td>
                        <td className="py-2.5 text-[var(--enterprise-subtitle)]">
                          <div className="space-y-0.5">
                            <p>{formatItemDateOrDash(fol.lastOpenedAt ?? folderLastOpenedIso)}</p>
                            <p className="inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--enterprise-text-muted)]">
                              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{fol.lastOpenedBy?.trim() || "—"}</span>
                            </p>
                          </div>
                        </td>
                        <td className="py-2.5 text-[var(--enterprise-text-muted)]">
                          {inside.total} item{inside.total !== 1 ? "s" : ""}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-0.5">
                            {onDownloadFolder ? (
                              <button
                                type="button"
                                className="rounded-md p-1 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
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
                              className="rounded-md p-1 text-[var(--enterprise-text-muted)] hover:bg-red-50 hover:text-red-600"
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
                  {files.map(
                    // fallow-ignore-next-line complexity, code-duplication
                    (f) => {
                      const sv = sortedVersions(f);
                      const latest = sv[0];
                      const displayVer =
                        sv.find((x) => x.version === selectedVersionForFile(f)) ?? latest;
                      const selected = fileRowSelected(f);
                      return (
                        <tr
                          key={f.id}
                          draggable={canDragItems}
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
                          className={`cursor-pointer border-b border-[var(--enterprise-border-subtle)] transition-colors last:border-b-0 ${
                            selected
                              ? federationIfcIds?.has(f.id)
                                ? "bg-emerald-50/90"
                                : "bg-[var(--enterprise-primary-soft)]/80"
                              : "hover:bg-[var(--enterprise-bg)]"
                          }`}
                          onClick={(e) => {
                            const federationToggle =
                              isIfcFile(f) && onToggleFederationIfc && (e.metaKey || e.ctrlKey);
                            handleFileSelect(f, e);
                            if (!federationToggle) onOpenFile(f);
                          }}
                        >
                          <td className="py-2.5 pl-4">
                            <div className="min-w-0">
                              <span className="inline-flex items-center gap-1.5 font-normal text-[var(--enterprise-text)]">
                                {isPdfFile(f) ? (
                                  <PdfFileIcon className="h-3.5 w-3.5 shrink-0" />
                                ) : isIfcFile(f) ? (
                                  <span className="relative inline-flex shrink-0">
                                    <IfcFileIcon className="h-3.5 w-3.5" />
                                    {ifcStatusSpinning(ifcModelStatus?.(f)) ? (
                                      <Loader2
                                        className="absolute -right-1.5 -top-1.5 h-3 w-3 animate-spin text-[var(--enterprise-primary)]"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </span>
                                ) : (
                                  <FileText
                                    className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                                    strokeWidth={1.75}
                                    aria-hidden
                                  />
                                )}
                                <span className="truncate">{f.name}</span>
                                {(f.commentCount ?? 0) > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--enterprise-primary-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--enterprise-primary)]">
                                    <MessageSquare className="h-3 w-3" aria-hidden />
                                    {f.commentCount}
                                  </span>
                                ) : null}
                              </span>
                              {searchActive ? (
                                <SearchPathHint
                                  path={folderPathLabel(project.folders, f.folderId)}
                                />
                              ) : null}
                              {renderIfcActions(f)}
                            </div>
                          </td>
                          <td className="py-2.5 text-[var(--enterprise-text-muted)]">
                            {isPdfFile(f) ? "PDF" : isIfcFile(f) ? "IFC" : "File"}
                          </td>
                          <td className="py-2.5 text-[var(--enterprise-subtitle)]">
                            {versionUi && sv.length > 1 && onFileVersionPick ? (
                              <select
                                className="max-w-[140px] rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-1.5 py-1 text-xs text-[var(--enterprise-text)]"
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
                              <span className="text-[var(--enterprise-text-muted)]">
                                v{latest.version}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 text-[var(--enterprise-subtitle)]">
                            {formatItemDateOrDash(displayVer?.createdAt ?? f.updatedAt)}
                          </td>
                          <td className="py-2.5 text-[var(--enterprise-subtitle)]">
                            {formatItemDateOrDash(f.lastOpenedAt)}
                          </td>
                          <td className="py-2.5 text-[var(--enterprise-text-muted)]">
                            {displayVer ? formatBytes(displayVer.sizeBytes) : "—"}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-50"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (!onOpenViewer) return;
                                  onOpenViewer(f);
                                }}
                                disabled={!onOpenViewer}
                                title="Open"
                                aria-label={`Open ${f.name}`}
                              >
                                <Eye className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onOpenFile(f);
                                }}
                                title="Details"
                                aria-label={`Open details for ${f.name}`}
                              >
                                <FileText className="h-4 w-4" aria-hidden />
                              </button>
                              {onDownloadFile ? (
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] disabled:opacity-50"
                                  disabled={downloadingKey === `file:${f.id}`}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    void onDownloadFile(f);
                                  }}
                                  title="Download"
                                  aria-label={`Download ${f.name}`}
                                >
                                  {downloadingKey === `file:${f.id}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  ) : (
                                    <Download className="h-4 w-4" aria-hidden />
                                  )}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50"
                                disabled={deletingKey === `file:${f.id}`}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  void onDeleteFile(f);
                                }}
                                title="Delete"
                                aria-label={`Delete ${f.name}`}
                              >
                                {deletingKey === `file:${f.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

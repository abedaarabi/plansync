"use client";

import { Fragment, useEffect, useRef } from "react";
import {
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FolderPlus,
  Home,
  Loader2,
  PanelLeft,
  Search,
  Upload,
  Users,
} from "lucide-react";

export type BreadcrumbItem = {
  id: string | null;
  label: string;
};

export type FileExplorerInsightsAction = {
  onClick: () => void;
  hint: string;
  showNewBadge: boolean;
};

export type FileExplorerTopBarProps = {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewFolder: () => void;
  uploadLabel: string;
  uploadDisabled?: boolean;
  uploading?: boolean;
  /** Must match the id of a single shared `<input type="file" />` in the parent. */
  uploadInputId: string;
  /** Optional: copy files from Google Drive / OneDrive / Dropbox into the project. */
  onImportFromCloud?: () => void;
  /** Below `lg`, opens the full folder tree (sidebar is hidden on small screens). */
  onOpenFolderTree?: () => void;
  /** Optional compact folder-access action for the selected folder. */
  folderAccess?: { summary: string; onClick: () => void };
  /** Optional files insights control — rendered next to Upload. */
  insights?: FileExplorerInsightsAction;
};

const FILE_EXPLORER_SEARCH_INPUT_ID = "file-explorer-search";

const actionBtn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2.5 text-xs font-medium text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-ring-focus)] max-xl:w-8 max-xl:px-0";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * Top bar: breadcrumbs, search, secondary + primary actions.
 */
export function FileExplorerTopBar({
  breadcrumbs,
  onNavigate,
  searchValue,
  onSearchChange,
  onNewFolder,
  uploadLabel,
  uploadDisabled,
  uploading,
  uploadInputId,
  onImportFromCloud,
  onOpenFolderTree,
  folderAccess,
  insights,
}: FileExplorerTopBarProps) {
  const current = breadcrumbs[breadcrumbs.length - 1];
  const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="flex flex-col gap-2 border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)]/95 px-3 py-2.5 backdrop-blur-sm sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <div className="flex min-w-0 items-center gap-1 lg:hidden">
          {parent ? (
            <button
              type="button"
              onClick={() => onNavigate(parent.id)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-ring-focus)]"
              aria-label={`Back to ${parent.label}`}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <span className="w-8 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--enterprise-text)]">
              {current?.label ?? "Files"}
            </p>
            <p className="truncate text-[10px] text-[var(--enterprise-text-muted)]">
              In this folder
            </p>
          </div>
          {onOpenFolderTree ? (
            <button
              type="button"
              onClick={onOpenFolderTree}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-ring-focus)]"
              aria-label="Browse all folders"
            >
              <PanelLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        <nav
          className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-0.5 text-xs lg:flex"
          aria-label="Folder path"
        >
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={crumb.id ?? "root"}>
              {i > 0 ? (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onNavigate(crumb.id)}
                className={`inline-flex max-w-[min(100%,200px)] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-ring-focus)] ${
                  i === breadcrumbs.length - 1
                    ? "font-semibold text-[var(--enterprise-text)]"
                    : "font-medium text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)]"
                }`}
              >
                {i === 0 ? (
                  <Home
                    className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{crumb.label}</span>
              </button>
            </Fragment>
          ))}
        </nav>
      </div>

      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2 xl:w-auto xl:min-w-0">
        <div className="relative w-full min-w-0 sm:max-w-[14rem] xl:max-w-[16rem]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={searchRef}
            id={FILE_EXPLORER_SEARCH_INPUT_ID}
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search folders & files… (/)"
            className="w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-1.5 pl-8 pr-2.5 text-xs text-[var(--enterprise-text)] placeholder:text-[var(--enterprise-text-muted)] focus:border-[var(--enterprise-primary)] focus:bg-[var(--enterprise-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
            aria-label="Search files and folders in this location and subfolders. Press slash to focus."
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {folderAccess ? (
            <button
              type="button"
              onClick={folderAccess.onClick}
              className={actionBtn}
              aria-label={`Folder access: ${folderAccess.summary}`}
              title={`Folder access: ${folderAccess.summary}`}
            >
              <Users
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                strokeWidth={2}
                aria-hidden
              />
              <span className="hidden max-w-[140px] truncate xl:inline">
                {folderAccess.summary}
              </span>
            </button>
          ) : null}
          <button type="button" onClick={onNewFolder} className={actionBtn} aria-label="New folder">
            <FolderPlus
              className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
              strokeWidth={2}
              aria-hidden
            />
            <span className="hidden xl:inline">New folder</span>
          </button>
          {onImportFromCloud ? (
            <button
              type="button"
              onClick={onImportFromCloud}
              className={`${actionBtn} max-sm:hidden`}
              aria-label="Import from cloud"
            >
              <Cloud
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
                strokeWidth={2}
                aria-hidden
              />
              <span className="hidden xl:inline">Import</span>
            </button>
          ) : null}
          {insights ? (
            <button
              type="button"
              onClick={insights.onClick}
              className={`relative ${actionBtn}`}
              aria-label={`Files insights · ${insights.hint}`}
            >
              <ChartPie
                className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-primary)]"
                strokeWidth={2}
                aria-hidden
              />
              <span className="hidden xl:inline">Insights</span>
              <span className="hidden tabular-nums text-[var(--enterprise-text-muted)] xl:inline">
                · {insights.hint}
              </span>
              {insights.showNewBadge ? (
                <span
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--enterprise-primary)] ring-2 ring-[var(--enterprise-bg)]"
                  aria-label="New"
                />
              ) : null}
            </button>
          ) : null}
          <label
            htmlFor={uploadInputId}
            className={`inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-2.5 text-xs font-semibold text-white transition hover:bg-[var(--enterprise-primary-deep)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--enterprise-primary)]/35 max-xl:px-2 ${
              uploadDisabled ? "pointer-events-none opacity-70" : ""
            }`}
            aria-label={uploadLabel}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            )}
            <span className="hidden xl:inline">Upload</span>
          </label>
        </div>
      </div>
    </header>
  );
}

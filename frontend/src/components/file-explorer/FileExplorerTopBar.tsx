"use client";

import { Fragment } from "react";
import { ChevronRight, Cloud, FolderPlus, Home, Loader2, Search, Upload } from "lucide-react";

export type BreadcrumbItem = {
  id: string | null;
  label: string;
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
};

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
}: FileExplorerTopBarProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/75 bg-white/95 px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-7">
      <nav
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1 text-sm"
        aria-label="Folder path"
      >
        {breadcrumbs.map((crumb, i) => (
          <Fragment key={crumb.id ?? "root"}>
            {i > 0 ? (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-slate-300"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              onClick={() => onNavigate(crumb.id)}
              className={`inline-flex max-w-[min(100%,240px)] items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--enterprise-primary)] ${
                i === breadcrumbs.length - 1
                  ? "font-semibold text-[var(--enterprise-text)]"
                  : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-[var(--enterprise-text)]"
              }`}
            >
              {i === 0 ? (
                <Home className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
              ) : null}
              <span className="truncate">{crumb.label}</span>
            </button>
          </Fragment>
        ))}
      </nav>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <div className="relative w-full min-w-0 sm:max-w-xs sm:min-w-[200px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search in folder…"
            className="w-full rounded-xl border border-slate-200/85 bg-slate-50/80 py-2.5 pl-9 pr-3 text-sm text-[var(--enterprise-text)] shadow-inner shadow-slate-200/40 placeholder:text-slate-400 focus:border-[var(--enterprise-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
            aria-label="Search files and folders in current location"
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onNewFolder}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--enterprise-primary)]"
          >
            <FolderPlus className="h-4 w-4 text-slate-500" strokeWidth={2} />
            New folder
          </button>
          {onImportFromCloud ? (
            <button
              type="button"
              onClick={onImportFromCloud}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--enterprise-primary)]"
            >
              <Cloud className="h-4 w-4 text-slate-500" strokeWidth={2} aria-hidden />
              Import from cloud
            </button>
          ) : null}
          <label
            htmlFor={uploadInputId}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/15 transition hover:bg-[var(--enterprise-primary-deep)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--enterprise-primary)]/35 ${
              uploadDisabled ? "pointer-events-none opacity-70" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
            {uploadLabel}
          </label>
        </div>
      </div>
    </header>
  );
}

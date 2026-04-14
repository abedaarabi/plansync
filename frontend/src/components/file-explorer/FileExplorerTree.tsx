"use client";

import { useMemo, type ReactNode } from "react";
import { ChevronRight, Folder as FolderIcon, Home } from "lucide-react";
import type { Folder as ProjectFolder } from "@/types/projects";

/** One horizontal step per depth (chevron column matches this so guides line up) */
const INDENT_PX = 12;
const CHEVRON_W = 12;
const ROOT_DROP_KEY = "root";

/** Pixels after the vertical line before row content: INDENT − half chevron, so child rows align to the next step */
function guidePaddingLeft(): number {
  return Math.max(1, INDENT_PX - Math.floor(CHEVRON_W / 2));
}

function folderDropKey(folderId: string | null) {
  return folderId === null ? ROOT_DROP_KEY : `folder:${folderId}`;
}

function TreeRow({
  hasChildren,
  isOpen,
  isSelected,
  isDropTarget,
  label,
  onToggleExpand,
  onSelect,
  icon,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropTarget,
  folderId,
  onDragStartMove,
}: {
  hasChildren: boolean;
  isOpen: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  label: string;
  onToggleExpand: () => void;
  onSelect: () => void;
  icon: "home" | "folder";
  onDragOverTarget?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragLeaveTarget?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDropTarget?: (e: React.DragEvent<HTMLButtonElement>) => void;
  folderId?: string;
  onDragStartMove?: (e: React.DragEvent<HTMLButtonElement>, folderId: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-stretch gap-0">
      <div
        className="flex shrink-0 items-center justify-center text-slate-400"
        style={{ width: CHEVRON_W }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--enterprise-primary)]"
            aria-label={isOpen ? "Collapse folder" : "Expand folder"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${isOpen ? "rotate-90" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        ) : (
          <span className="inline-block w-3" aria-hidden />
        )}
      </div>
      <button
        type="button"
        draggable={icon === "folder" && Boolean(folderId) && Boolean(onDragStartMove)}
        onDragStart={
          icon === "folder" && folderId && onDragStartMove
            ? (e) => onDragStartMove(e, folderId)
            : undefined
        }
        onClick={onSelect}
        onKeyDown={(e) => {
          if (!hasChildren) return;
          if (e.key === "ArrowRight" && !isOpen) {
            e.preventDefault();
            onToggleExpand();
          } else if (e.key === "ArrowLeft" && isOpen) {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        onDragOver={onDragOverTarget}
        onDragLeave={onDragLeaveTarget}
        onDrop={onDropTarget}
        className={`group flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[13px] leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--enterprise-primary)] ${
          isSelected
            ? "bg-[var(--enterprise-primary-soft)] font-medium text-[var(--enterprise-primary-deep)] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]"
            : "text-[var(--enterprise-text)] hover:bg-slate-100/90"
        } ${isDropTarget ? "ring-2 ring-[var(--enterprise-primary)]/35 ring-inset bg-[var(--enterprise-primary-soft)]/60" : ""}`}
        aria-current={isSelected ? "true" : undefined}
      >
        <span className="shrink-0 rounded-md p-0.5" aria-hidden>
          {icon === "home" ? (
            <Home
              className={`h-4 w-4 ${
                isSelected
                  ? "text-[var(--enterprise-primary)]"
                  : "text-slate-400 group-hover:text-slate-600"
              }`}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <FolderIcon
              className={`h-4 w-4 ${
                isSelected ? "text-[var(--enterprise-primary)]" : "text-amber-500/90"
              }`}
              strokeWidth={1.75}
              aria-hidden
            />
          )}
        </span>
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

/** Vertical guide aligned to parent chevron; indentation comes from margin only */
function TreeChildrenGuide({ depth, children }: { depth: number; children: ReactNode }) {
  const ml = depth * INDENT_PX + Math.floor(CHEVRON_W / 2) - 1;
  const pl = guidePaddingLeft();
  return (
    <div
      className="border-l border-slate-300/90 bg-transparent"
      style={{ marginLeft: ml, paddingLeft: pl }}
    >
      {children}
    </div>
  );
}

function TreeBranch({
  folders,
  parentId,
  selectedId,
  expanded,
  dropTargetKey,
  onToggleExpand,
  onSelect,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
  onDragStartMove,
  depth,
}: {
  folders: ProjectFolder[];
  parentId: string | null;
  selectedId: string | null;
  expanded: Set<string>;
  dropTargetKey: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string | null) => void;
  onDragOverFolder?: (e: React.DragEvent<HTMLButtonElement>, id: string) => void;
  onDragLeaveFolder?: (e: React.DragEvent<HTMLButtonElement>, id: string) => void;
  onDropOnFolder?: (e: React.DragEvent<HTMLButtonElement>, id: string) => void;
  onDragStartMove?: (e: React.DragEvent<HTMLButtonElement>, folderId: string) => void;
  depth: number;
}) {
  const children = useMemo(
    () =>
      [...folders.filter((f) => f.parentId === parentId)].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [folders, parentId],
  );

  if (children.length === 0) return null;

  return (
    <ul className="space-y-0" role="group">
      {children.map((fol) => {
        const hasKids = folders.some((f) => f.parentId === fol.id);
        const isOpen = expanded.has(fol.id);
        const isSelected = selectedId === fol.id;
        return (
          <li
            key={fol.id}
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={hasKids ? isOpen : undefined}
          >
            <TreeRow
              hasChildren={hasKids}
              isOpen={isOpen}
              isSelected={isSelected}
              isDropTarget={dropTargetKey === folderDropKey(fol.id)}
              label={fol.name}
              onToggleExpand={() => onToggleExpand(fol.id)}
              onSelect={() => onSelect(fol.id)}
              icon="folder"
              onDragOverTarget={onDragOverFolder ? (e) => onDragOverFolder(e, fol.id) : undefined}
              onDragLeaveTarget={
                onDragLeaveFolder ? (e) => onDragLeaveFolder(e, fol.id) : undefined
              }
              onDropTarget={onDropOnFolder ? (e) => onDropOnFolder(e, fol.id) : undefined}
              folderId={fol.id}
              onDragStartMove={onDragStartMove}
            />
            {hasKids ? (
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <TreeChildrenGuide depth={depth}>
                    <TreeBranch
                      folders={folders}
                      parentId={fol.id}
                      selectedId={selectedId}
                      expanded={expanded}
                      dropTargetKey={dropTargetKey}
                      onToggleExpand={onToggleExpand}
                      onSelect={onSelect}
                      onDragOverFolder={onDragOverFolder}
                      onDragLeaveFolder={onDragLeaveFolder}
                      onDropOnFolder={onDropOnFolder}
                      onDragStartMove={onDragStartMove}
                      depth={depth + 1}
                    />
                  </TreeChildrenGuide>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export type FileExplorerTreeProps = {
  folders: ProjectFolder[];
  rootLabel: string;
  selectedFolderId: string | null;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectFolder: (id: string | null) => void;
  dropTargetKey?: string | null;
  onDragOverFolder?: (e: React.DragEvent<HTMLButtonElement>, id: string | null) => void;
  onDragLeaveFolder?: (e: React.DragEvent<HTMLButtonElement>, id: string | null) => void;
  onDropOnFolder?: (e: React.DragEvent<HTMLButtonElement>, id: string | null) => void;
  onDragStartMove?: (e: React.DragEvent<HTMLButtonElement>, folderId: string) => void;
  className?: string;
  /** When false, hides the small upper "Folders" label (parent supplies chrome, e.g. a mobile drawer). */
  showSectionLabel?: boolean;
};

/**
 * Left-rail folder tree: nested folders, smooth expand/collapse, independent scroll.
 */
export function FileExplorerTree({
  folders,
  rootLabel,
  selectedFolderId,
  expanded,
  onToggleExpand,
  onSelectFolder,
  dropTargetKey = null,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
  onDragStartMove,
  className = "",
  showSectionLabel = true,
}: FileExplorerTreeProps) {
  return (
    <nav
      className={`flex h-full min-h-0 flex-col bg-transparent ${className}`}
      aria-label="Folder tree"
    >
      {showSectionLabel ? (
        <div className="border-b border-slate-200/70 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Folders
          </p>
        </div>
      ) : null}
      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 ${showSectionLabel ? "" : "pt-3"}`}
      >
        <div role="tree" aria-label="Project folders" className="space-y-0">
          <div role="treeitem" aria-selected={selectedFolderId === null}>
            <TreeRow
              hasChildren={false}
              isOpen={false}
              isSelected={selectedFolderId === null}
              isDropTarget={dropTargetKey === folderDropKey(null)}
              label={rootLabel}
              onToggleExpand={() => {}}
              onSelect={() => onSelectFolder(null)}
              icon="home"
              onDragOverTarget={onDragOverFolder ? (e) => onDragOverFolder(e, null) : undefined}
              onDragLeaveTarget={onDragLeaveFolder ? (e) => onDragLeaveFolder(e, null) : undefined}
              onDropTarget={onDropOnFolder ? (e) => onDropOnFolder(e, null) : undefined}
            />
          </div>
          {/* Top-level folders: line lines up with project row chevron column */}
          <TreeChildrenGuide depth={0}>
            <TreeBranch
              folders={folders}
              parentId={null}
              selectedId={selectedFolderId}
              expanded={expanded}
              dropTargetKey={dropTargetKey}
              onToggleExpand={onToggleExpand}
              onSelect={onSelectFolder}
              onDragOverFolder={onDragOverFolder}
              onDragLeaveFolder={onDragLeaveFolder}
              onDropOnFolder={onDropOnFolder}
              onDragStartMove={onDragStartMove}
              depth={0}
            />
          </TreeChildrenGuide>
        </div>
      </div>
    </nav>
  );
}

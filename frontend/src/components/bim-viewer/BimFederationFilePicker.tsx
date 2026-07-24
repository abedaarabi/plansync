"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IfcFileIcon } from "@/components/icons/IfcFileIcon";
import { fetchProject, fetchProjects } from "@/lib/api-client";
import { isIfcFile } from "@/lib/isPdfFile";
import type { CloudFile, Project } from "@/types/projects";
import { folderBreadcrumb, sortedVersions } from "@/components/file-explorer/fileExplorerUtils";

function folderIdForFile(project: Project, fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  return project.files.find((f) => f.id === fileId)?.folderId ?? null;
}

// fallow-ignore-next-line complexity
export function BimFederationFilePicker(props: {
  projectId: string;
  anchorFileId: string;
  loadedFileVersionIds: Set<string>;
  addingFileVersionId?: string | null;
  onPickFile: (file: CloudFile, fileVersionId: string, version: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // fallow-ignore-next-line complexity
  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const meta = await fetchProject(props.projectId);
      const projects = await fetchProjects(meta.workspaceId);
      const found = projects.find((p) => p.id === props.projectId) ?? null;
      setProject(found);
      setCurrentFolderId(found ? folderIdForFile(found, props.anchorFileId) : null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load project files.");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [props.anchorFileId, props.projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (!project) return;
    setCurrentFolderId(folderIdForFile(project, props.anchorFileId));
  }, [project, props.anchorFileId]);

  const breadcrumbs = useMemo(
    () => (project ? folderBreadcrumb(currentFolderId, project.folders) : []),
    [project, currentFolderId],
  );

  const subfolders = useMemo(() => {
    if (!project) return [];
    return [...project.folders.filter((f) => f.parentId === currentFolderId)].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [project, currentFolderId]);

  const ifcFiles = useMemo(() => {
    if (!project) return [];
    return [...project.files.filter((f) => f.folderId === currentFolderId && isIfcFile(f))].sort(
      (a, b) => a.name.localeCompare(b.name),
    );
  }, [project, currentFolderId]);

  const pickFile = (file: CloudFile) => {
    const versions = sortedVersions(file);
    const latest = versions[0];
    if (!latest) {
      toast.error("This file has no revisions.");
      return;
    }
    props.onPickFile(file, latest.id, latest.version);
  };

  // fallow-ignore-next-line complexity
  const ifcFileRows = ifcFiles.map((file) => {
    const latest = sortedVersions(file)[0];
    const inSession = latest ? props.loadedFileVersionIds.has(latest.id) : false;
    const isAdding = latest ? props.addingFileVersionId === latest.id : false;
    return (
      <div key={file.id} className="flex items-center gap-2 px-3 py-1.5">
        <IfcFileIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-[var(--bim-chrome-text)]"
          title={file.name}
        >
          {file.name}
        </span>
        <button
          type="button"
          disabled={inSession || !latest || isAdding || props.addingFileVersionId != null}
          onClick={() => pickFile(file)}
          className="bim-focus-ring flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-[var(--bim-accent)] hover:bg-[color-mix(in_srgb,var(--bim-chrome-surface)_70%,transparent)] disabled:opacity-50"
        >
          {isAdding ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Adding…
            </>
          ) : inSession ? (
            "Loaded"
          ) : (
            "Add"
          )}
        </button>
      </div>
    );
  });

  return (
    <div className="bim-federation-picker bim-glass-surface mx-3 mb-3 overflow-hidden rounded-xl border border-[var(--bim-chrome-border)]">
      <div className="border-b border-[var(--bim-chrome-border)] px-3 py-2">
        <p className="text-[11px] font-semibold text-[var(--bim-chrome-text)]">Project files</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-[var(--bim-chrome-text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading folders…
        </div>
      ) : !project ? (
        <p className="px-3 py-4 text-[11px] text-[var(--bim-chrome-text-muted)]">
          Could not load project files.
        </p>
      ) : (
        <>
          <nav
            aria-label="Folder path"
            className="flex flex-wrap items-center gap-0.5 border-b border-[var(--bim-chrome-border)] px-2 py-1.5"
          >
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={`bim-focus-ring max-w-[8rem] truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                currentFolderId === null
                  ? "text-[var(--bim-chrome-text)]"
                  : "text-[var(--bim-accent)] hover:underline"
              }`}
            >
              Files
            </button>
            {breadcrumbs.map((folder, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={folder.id} className="flex min-w-0 items-center gap-0.5">
                  <ChevronRight
                    className="h-3 w-3 shrink-0 text-[var(--bim-chrome-text-muted)]"
                    aria-hidden
                  />
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`bim-focus-ring max-w-[7rem] truncate rounded px-1.5 py-0.5 text-[10px] font-medium disabled:cursor-default ${
                      isLast
                        ? "text-[var(--bim-chrome-text)]"
                        : "text-[var(--bim-accent)] hover:underline"
                    }`}
                  >
                    {folder.name}
                  </button>
                </span>
              );
            })}
          </nav>

          <div className="max-h-44 overflow-y-auto py-1">
            {subfolders.length === 0 && ifcFiles.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-[var(--bim-chrome-text-muted)]">
                No IFC files in this folder.
              </p>
            ) : null}

            {subfolders.map((folder) => {
              const childIfcCount = project.files.filter(
                (f) => isIfcFile(f) && f.folderId === folder.id,
              ).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="bim-focus-ring bim-tree-row flex w-full items-center gap-2 px-3 py-1.5 text-left"
                >
                  <Folder
                    className="h-3.5 w-3.5 shrink-0 text-[var(--bim-chrome-text-muted)]"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--bim-chrome-text)]">
                    {folder.name}
                  </span>
                  {childIfcCount > 0 ? (
                    <span className="shrink-0 text-[10px] tabular-nums text-[var(--bim-chrome-text-muted)]">
                      {childIfcCount} IFC
                    </span>
                  ) : null}
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--bim-chrome-text-muted)]"
                    aria-hidden
                  />
                </button>
              );
            })}

            {ifcFileRows}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { apiUrl } from "@/lib/api-url";
import { downloadProjectFileVersion } from "@/lib/downloadProjectFile";
import { isImageThumbnailFile, isPdfFile } from "@/lib/isPdfFile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { fetchProjects } from "@/lib/api-client";
import {
  addFolderToProjectCache,
  moveFileInProjectCache,
  moveFolderInProjectCache,
  removeFileFromProjectCache,
  removeFolderSubtreeFromProjectCache,
  replaceOptimisticFolder,
} from "@/lib/projectsCache";
import { qk } from "@/lib/queryKeys";
import { nanoid } from "nanoid";
import type { CloudFile, Folder as ProjectFolder } from "@/types/projects";
import {
  MOVE_DRAG_MIME,
  type MoveDragPayload,
  useUploadQueueStore,
} from "@/store/uploadQueueStore";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import { ProjectFileImageLightbox } from "./ProjectFileImageLightbox";
import { UploadDrawingsWizard } from "./UploadDrawingsWizard";
import { CloudImportModal } from "./CloudImportModal";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import {
  FileExplorerContent,
  FileExplorerDeleteConfirmDialog,
  FileExplorerPageSkeleton,
  FileExplorerTopBar,
  FileExplorerTree,
  filterByName,
  folderBreadcrumb,
  sortedVersions,
} from "@/components/file-explorer";

const UPLOAD_INPUT_ID = "project-files-upload-input";
const ROOT_DROP_KEY = "root";
const SMART_UPLOAD_FLOW_ENABLED = process.env.NEXT_PUBLIC_SMART_UPLOAD_FLOW !== "0";

function folderDropKey(folderId: string | null) {
  return folderId === null ? ROOT_DROP_KEY : `folder:${folderId}`;
}

function hasMoveDrag(e: React.DragEvent) {
  return Array.from(e.dataTransfer.types).includes(MOVE_DRAG_MIME);
}

type PendingDeletion =
  | { type: "file"; file: CloudFile }
  | { type: "folder"; folder: ProjectFolder }
  | null;

export function ProjectFilesClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = primary?.workspace.subscriptionStatus === "active";

  const { data: projects = [], isPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const project = projects.find((p) => p.id === projectId);

  const folderParam = searchParams.get("folder");

  /** Current folder from URL; while project loads, keep `folder` query so refresh lands correctly. */
  const folderId = useMemo(() => {
    if (!folderParam) return null;
    if (!project) return folderParam;
    const ok = project.folders.some((f) => f.id === folderParam);
    return ok ? folderParam : null;
  }, [project, folderParam]);

  const navigateFolder = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("folder", next);
      else params.delete("folder");
      const q = params.toString();
      router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!project || !folderParam) return;
    const ok = project.folders.some((f) => f.id === folderParam);
    if (ok) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("folder");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [project, folderParam, pathname, router, searchParams]);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [uploadWizardOpen, setUploadWizardOpen] = useState(false);
  const [uploadWizardInitialFiles, setUploadWizardInitialFiles] = useState<File[]>([]);
  const [uploadWizardFolderId, setUploadWizardFolderId] = useState<string | null>(folderId);
  const [imageLightbox, setImageLightbox] = useState<{
    fileId: string;
    fileName: string;
    version: number;
  } | null>(null);
  const [cloudImportOpen, setCloudImportOpen] = useState(false);

  const toggleTreeExpand = useCallback((id: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!project || !folderId) return;
    const ancestors = folderBreadcrumb(folderId, project.folders);
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      ancestors.forEach((a) => next.add(a.id));
      return next;
    });
  }, [folderId, project]);

  useEffect(() => {
    setSelectedItemKey(null);
  }, [folderId]);

  useEffect(() => {
    const ok = searchParams.get("cloud_import");
    const err = searchParams.get("cloud_import_error");
    if (!ok && !err) return;
    if (ok === "connected") {
      toast.success("Cloud storage connected. You can import files.");
      setCloudImportOpen(true);
    }
    if (err) {
      toast.error(decodeURIComponent(err));
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cloud_import");
    params.delete("cloud_import_error");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const [fileVersionPick, setFileVersionPick] = useState<Record<string, number>>({});
  useEffect(() => {
    setFileVersionPick({});
  }, [folderId]);

  const subfolders = useMemo(() => {
    const list = project?.folders.filter((f) => f.parentId === folderId) ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [project, folderId]);

  const visibleFiles = useMemo(() => {
    if (!project) return [];
    return project.files.filter((f) => f.folderId === folderId);
  }, [project, folderId]);

  const sortedFiles = useMemo(
    () =>
      [...visibleFiles].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [visibleFiles],
  );

  const filteredSubfolders = useMemo(
    () => filterByName(subfolders, searchQuery),
    [subfolders, searchQuery],
  );
  const filteredFiles = useMemo(
    () => filterByName(sortedFiles, searchQuery),
    [sortedFiles, searchQuery],
  );

  const breadcrumb = useMemo(
    () => (project ? folderBreadcrumb(folderId, project.folders) : []),
    [project, folderId],
  );

  const breadcrumbItems = useMemo(() => {
    if (!project) return [];
    return [
      { id: null as string | null, label: project.name },
      ...breadcrumb.map((f) => ({ id: f.id, label: f.name })),
    ];
  }, [project, breadcrumb]);

  const invalidate = useCallback(async () => {
    if (wid) {
      await queryClient.invalidateQueries({ queryKey: qk.projects(wid) });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard(wid) });
    }
    await queryClient.invalidateQueries({ queryKey: qk.projectAudit(projectId) });
    await queryClient.invalidateQueries({ queryKey: qk.me() });
  }, [queryClient, wid, projectId]);

  const bindDragStartMove = useCallback((e: React.DragEvent, payload: MoveDragPayload) => {
    e.dataTransfer.setData(MOVE_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const moveExplorerItem = useCallback(
    async (payload: MoveDragPayload, targetFolderId: string | null) => {
      if (!wid || !project) return;
      if (payload.kind === "file") {
        const f = project.files.find((x) => x.id === payload.id);
        if (!f || f.folderId === targetFolderId) return;
        moveFileInProjectCache(queryClient, wid, projectId, payload.id, targetFolderId);
        try {
          const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/files/${payload.id}`), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: targetFolderId }),
          });
          if (!res.ok) {
            await invalidate();
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            toast.error(j.error ?? "Could not move file.");
            return;
          }
          await invalidate();
        } catch {
          await invalidate();
          toast.error("Could not move file.");
        }
        return;
      }

      const fol = project.folders.find((x) => x.id === payload.id);
      if (!fol) return;
      if (fol.parentId === targetFolderId) return;
      if (targetFolderId === payload.id) return;
      moveFolderInProjectCache(queryClient, wid, projectId, payload.id, targetFolderId);
      try {
        const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/folders/${payload.id}`), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: targetFolderId }),
        });
        if (!res.ok) {
          await invalidate();
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(j.error ?? "Could not move folder.");
          return;
        }
        await invalidate();
      } catch {
        await invalidate();
        toast.error("Could not move folder.");
      }
    },
    [wid, project, projectId, queryClient, invalidate],
  );

  function enqueueUploads(files: File[], targetFolderId: string | null = folderId) {
    if (!wid) {
      toast.error("Workspace not ready.");
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;

    const pdfs = list.filter((file) => isPdfFile(file));
    const nonPdfs = list.filter((file) => !isPdfFile(file));

    if (nonPdfs.length > 0) {
      useUploadQueueStore.getState().enqueue({
        workspaceId: wid,
        projectId,
        folderId: targetFolderId,
        files: nonPdfs,
        queryClient,
      });
    }

    if (pdfs.length === 0) return;

    if (SMART_UPLOAD_FLOW_ENABLED) {
      setUploadWizardInitialFiles(pdfs);
      setUploadWizardFolderId(targetFolderId);
      setUploadWizardOpen(true);
      return;
    }
    useUploadQueueStore.getState().enqueue({
      workspaceId: wid,
      projectId,
      folderId: targetFolderId,
      files: pdfs,
      queryClient,
    });
  }

  function openFile(f: CloudFile) {
    const sorted = sortedVersions(f);
    const fallback = sorted[0]?.version ?? 1;
    const pick = fileVersionPick[f.id];
    const v = pick != null && sorted.some((x) => x.version === pick) ? pick : fallback;
    const verRow = sorted.find((x) => x.version === v) ?? sorted[0];

    const ver = verRow?.version ?? v;

    if (isImageThumbnailFile(f)) {
      setImageLightbox({ fileId: f.id, fileName: f.name, version: ver });
      return;
    }

    if (!isPdfFile(f)) {
      const base = apiUrl(`/api/v1/files/${encodeURIComponent(f.id)}/content`);
      window.open(
        `${base}?version=${encodeURIComponent(String(ver))}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    const q = new URLSearchParams({ fileId: f.id, name: f.name });
    q.set("projectId", projectId);
    if (verRow) {
      q.set("version", String(verRow.version));
      q.set("fileVersionId", verRow.id);
    }
    router.push(`/viewer?${q.toString()}`);
  }

  async function onCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!wid || !folderName.trim()) return;
    setSaving(true);
    const tempId = `optimistic-${nanoid()}`;
    const opt: ProjectFolder = {
      id: tempId,
      name: folderName.trim(),
      parentId: folderId,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    addFolderToProjectCache(queryClient, wid, projectId, opt);
    try {
      const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/folders`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName.trim(),
          parentId: folderId ?? undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Could not create folder.");
        return;
      }
      const folder = (await res.json()) as ProjectFolder;
      replaceOptimisticFolder(queryClient, wid, projectId, tempId, folder);
      setFolderModal(false);
      setFolderName("");
    } finally {
      setSaving(false);
    }
  }

  function onUploadInput(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    // Copy File[] before clearing — resetting `value` empties the live FileList and breaks multi-select.
    const snapshot = input.files ? Array.from(input.files) : [];
    input.value = "";
    if (snapshot.length === 0) return;
    enqueueUploads(snapshot);
  }

  function handleDragEnter(e: React.DragEvent) {
    if (hasMoveDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setIsDragOver(false);
    setDropTargetKey(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasMoveDrag(e)) {
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(false);
      setDropTargetKey(null);
      return;
    }
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
    setDropTargetKey(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDropTargetKey(null);
    try {
      const moveRaw = e.dataTransfer.getData(MOVE_DRAG_MIME);
      if (moveRaw) {
        const payload = JSON.parse(moveRaw) as MoveDragPayload;
        void moveExplorerItem(payload, folderId);
        return;
      }
    } catch {
      /* ignore */
    }
    const snapshot = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (snapshot.length > 0) enqueueUploads(snapshot);
  }

  function handleDragOverFolder(e: React.DragEvent<HTMLElement>, targetFolderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = hasMoveDrag(e) ? "move" : "copy";
    setIsDragOver(false);
    setDropTargetKey(folderDropKey(targetFolderId));
  }

  function handleDragLeaveFolder(e: React.DragEvent<HTMLElement>, targetFolderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    if (dropTargetKey === folderDropKey(targetFolderId)) {
      setDropTargetKey(null);
    }
  }

  function handleDropOnFolder(e: React.DragEvent<HTMLElement>, targetFolderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDropTargetKey(null);
    try {
      const moveRaw = e.dataTransfer.getData(MOVE_DRAG_MIME);
      if (moveRaw) {
        const payload = JSON.parse(moveRaw) as MoveDragPayload;
        void moveExplorerItem(payload, targetFolderId);
        return;
      }
    } catch {
      /* ignore */
    }
    const snapshot = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (snapshot.length > 0) enqueueUploads(snapshot, targetFolderId);
  }

  async function downloadFile(file: CloudFile) {
    const sorted = sortedVersions(file);
    const fallback = sorted[0]?.version ?? 1;
    const pick = fileVersionPick[file.id];
    const v = pick != null && sorted.some((x) => x.version === pick) ? pick : fallback;
    const key = `file:${file.id}`;
    setDownloadingKey(key);
    try {
      await downloadProjectFileVersion({
        fileId: file.id,
        fileName: file.name,
        version: v,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadingKey(null);
    }
  }

  function requestDeleteFile(file: CloudFile) {
    setDeleteConfirmValue("");
    setPendingDeletion({ type: "file", file });
  }

  function requestDeleteFolder(folder: ProjectFolder) {
    setDeleteConfirmValue("");
    setPendingDeletion({ type: "folder", folder });
  }

  async function confirmDelete() {
    if (!wid || !pendingDeletion) return;
    if (deleteConfirmValue.trim().toLowerCase() !== "delete") {
      toast.error('Type "delete" to confirm.');
      return;
    }

    if (pendingDeletion.type === "file") {
      const file = pendingDeletion.file;
      setDeletingKey(`file:${file.id}`);
      removeFileFromProjectCache(queryClient, wid, projectId, file.id);
      try {
        const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/files/${file.id}`), {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) toast.error("Could not delete file.");
        else {
          await invalidate();
          setPendingDeletion(null);
          setDeleteConfirmValue("");
        }
      } finally {
        setDeletingKey(null);
      }
      return;
    }

    const folder = pendingDeletion.folder;
    setDeletingKey(`folder:${folder.id}`);
    removeFolderSubtreeFromProjectCache(queryClient, wid, projectId, folder.id);
    if (folderId === folder.id) navigateFolder(folder.parentId ?? null);
    try {
      const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/folders/${folder.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) toast.error("Could not delete folder.");
      else {
        await invalidate();
        setPendingDeletion(null);
        setDeleteConfirmValue("");
      }
    } finally {
      setDeletingKey(null);
    }
  }

  const loading = ctxLoading || isPending;
  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <FileExplorerPageSkeleton />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-[var(--enterprise-border)] bg-white p-10 text-center text-sm text-[var(--enterprise-text-muted)] shadow-sm">
        Project not found.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        id={UPLOAD_INPUT_ID}
        type="file"
        multiple
        className="sr-only"
        onChange={onUploadInput}
        aria-label="Upload files"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_12px_35px_-18px_rgba(15,23,42,0.25)]">
        <FileExplorerTopBar
          breadcrumbs={breadcrumbItems}
          onNavigate={navigateFolder}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onNewFolder={() => setFolderModal(true)}
          uploadLabel="Upload files"
          uploadDisabled={false}
          uploading={false}
          uploadInputId={UPLOAD_INPUT_ID}
          onImportFromCloud={() => setCloudImportOpen(true)}
        />

        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] md:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="flex min-h-0 shrink-0 flex-col border-r border-slate-200/70 bg-slate-50">
            <FileExplorerTree
              className="h-full"
              folders={project.folders}
              rootLabel={project.name}
              selectedFolderId={folderId}
              expanded={treeExpanded}
              onToggleExpand={toggleTreeExpand}
              onSelectFolder={navigateFolder}
              dropTargetKey={dropTargetKey}
              onDragOverFolder={handleDragOverFolder}
              onDragLeaveFolder={handleDragLeaveFolder}
              onDropOnFolder={handleDropOnFolder}
              onDragStartMove={(e, fid) => bindDragStartMove(e, { kind: "folder", id: fid })}
            />
          </aside>

          <FileExplorerContent
            project={project}
            currentFolderId={folderId}
            subfolders={filteredSubfolders}
            files={filteredFiles}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchQuery={searchQuery}
            selectedItemKey={selectedItemKey}
            onSelectItem={setSelectedItemKey}
            onOpenFolder={navigateFolder}
            onOpenFile={openFile}
            onDeleteFolder={requestDeleteFolder}
            onDeleteFile={requestDeleteFile}
            onDownloadFile={(f) => void downloadFile(f)}
            downloadingKey={downloadingKey}
            deletingKey={deletingKey}
            isDragOver={isDragOver}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            dropTargetKey={dropTargetKey}
            onDragOverFolder={handleDragOverFolder}
            onDragLeaveFolder={handleDragLeaveFolder}
            onDropOnFolder={handleDropOnFolder}
            uploadInputId={UPLOAD_INPUT_ID}
            uploadDisabled={false}
            onDragStartMove={bindDragStartMove}
            fileVersionPick={fileVersionPick}
            onFileVersionPick={(fid, ver) => setFileVersionPick((p) => ({ ...p, [fid]: ver }))}
          />
        </div>
      </div>

      <FileExplorerDeleteConfirmDialog
        open={Boolean(pendingDeletion)}
        targetName={
          pendingDeletion?.type === "file"
            ? pendingDeletion.file.name
            : (pendingDeletion?.folder.name ?? "")
        }
        targetType={pendingDeletion?.type ?? "file"}
        confirmValue={deleteConfirmValue}
        onConfirmValueChange={setDeleteConfirmValue}
        deleting={Boolean(deletingKey)}
        onCancel={() => {
          if (deletingKey) return;
          setPendingDeletion(null);
          setDeleteConfirmValue("");
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />

      <EnterpriseSlideOver
        open={folderModal}
        onClose={() => setFolderModal(false)}
        form={{ onSubmit: onCreateFolder }}
        ariaLabelledBy="project-files-new-folder-title"
        header={
          <div>
            <h2
              id="project-files-new-folder-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              New folder
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              Create a folder in this project.
            </p>
          </div>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setFolderModal(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <div>
          <label
            htmlFor="project-files-folder-name"
            className="text-xs font-medium text-[var(--enterprise-text-muted)]"
          >
            Folder name
          </label>
          <input
            id="project-files-folder-name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
            placeholder="e.g. Architectural"
            required
            autoFocus
          />
        </div>
      </EnterpriseSlideOver>
      {wid ? (
        <UploadDrawingsWizard
          open={uploadWizardOpen}
          onClose={() => setUploadWizardOpen(false)}
          initialFiles={uploadWizardInitialFiles}
          workspaceId={wid}
          projectId={projectId}
          folderId={uploadWizardFolderId}
          existingFiles={project.files.filter((f) => f.folderId === uploadWizardFolderId)}
        />
      ) : null}
      {imageLightbox ? (
        <ProjectFileImageLightbox
          fileId={imageLightbox.fileId}
          fileName={imageLightbox.fileName}
          version={imageLightbox.version}
          onClose={() => setImageLightbox(null)}
        />
      ) : null}
      {wid ? (
        <CloudImportModal
          open={cloudImportOpen}
          onClose={() => setCloudImportOpen(false)}
          workspaceId={wid}
          projectId={projectId}
          folderId={folderId}
          oauthReturnPath={`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
          onImported={() => {
            void invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

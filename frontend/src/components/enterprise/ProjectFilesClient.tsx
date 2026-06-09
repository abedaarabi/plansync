"use client";

import { apiUrl } from "@/lib/api-url";
import { downloadProjectFileVersion } from "@/lib/downloadProjectFile";
import { isImageThumbnailFile, isPdfFile } from "@/lib/isPdfFile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { FolderPlus, Globe2, ShieldCheck, Users } from "lucide-react";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  fetchProjectSession,
  fetchProjectTeam,
  fetchProjects,
  patchFolderAccess,
  requestFolderAccess,
} from "@/lib/api-client";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import {
  addFolderToProjectCache,
  moveFileInProjectCache,
  moveFolderInProjectCache,
  removeFileFromProjectCache,
  removeFileVersionFromProjectCache,
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
import { EnterpriseResponsiveDialog } from "@/components/mobile/EnterpriseResponsiveDialog";
import { ProjectFileImageLightbox } from "./ProjectFileImageLightbox";
import { UploadDrawingsWizard } from "./UploadDrawingsWizard";
import { CloudImportModal } from "./CloudImportModal";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import {
  FileExplorerContent,
  FileExplorerDeleteConfirmDialog,
  FileDetailSlideOver,
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

function userInitials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
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
  const { me, primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isPro = isWorkspaceProClient(primary?.workspace);

  const { data: projects = [], isPending } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });
  const { data: projectSession } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
    enabled: Boolean(projectId),
  });
  const { data: projectTeam } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId && projectSession && !projectSession.isExternal),
  });

  const project = projects.find((p) => p.id === projectId);
  const canUpload = Boolean(
    projectSession &&
    !projectSession.isExternal &&
    (projectSession.workspaceRole === "SUPER_ADMIN" || projectSession.workspaceRole === "ADMIN"),
  );
  const canManage = canUpload;
  const canViewDrawings = Boolean(
    !projectSession?.isExternal ||
    projectSession.uiMode !== "client" ||
    projectSession.settings.clientVisibility.showDrawings,
  );

  const folderParam = searchParams.get("folder");

  /** Current folder from URL; while project loads, keep `folder` query so refresh lands correctly. */
  const folderId = useMemo(() => {
    if (!folderParam) return null;
    if (!project) return folderParam;
    const ok = project.folders.some((f) => f.id === folderParam && f.canAccess !== false);
    return ok ? folderParam : null;
  }, [project, folderParam]);

  const navigateFolder = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("folder", next);
      else params.delete("folder");
      const q = params.toString();
      router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
      setMobileFolderTreeOpen(false);
    },
    [pathname, router, searchParams],
  );

  const folderById = useMemo(() => {
    const map = new Map<string, ProjectFolder>();
    for (const folder of project?.folders ?? []) map.set(folder.id, folder);
    return map;
  }, [project]);

  const hasFolderAccess = useCallback(
    (id: string | null) => {
      if (!id) return true;
      const folder = folderById.get(id);
      return folder?.canAccess !== false;
    },
    [folderById],
  );

  const openFolderOrRequest = useCallback(
    (id: string | null) => {
      if (id && !hasFolderAccess(id)) {
        const folder = folderById.get(id);
        if (folder) setAccessRequestFolder(folder);
        return;
      }
      navigateFolder(id);
    },
    [folderById, hasFolderAccess, navigateFolder],
  );

  useEffect(() => {
    if (!project || !folderParam) return;
    const target = project.folders.find((f) => f.id === folderParam);
    if (target && target.canAccess === false) {
      setAccessRequestFolder(target);
    }
    const ok = project.folders.some((f) => f.id === folderParam && f.canAccess !== false);
    if (ok) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("folder");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [project, folderParam, pathname, router, searchParams]);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [newFolderAccessMode, setNewFolderAccessMode] = useState<"all" | "selected">("all");
  const [newFolderAccessUserIds, setNewFolderAccessUserIds] = useState<string[]>([]);
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
  const [mobileFolderTreeOpen, setMobileFolderTreeOpen] = useState(false);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [folderAccessOpen, setFolderAccessOpen] = useState(false);
  const [folderAccessMode, setFolderAccessMode] = useState<"all" | "selected">("all");
  const [folderAccessUserIds, setFolderAccessUserIds] = useState<string[]>([]);
  const [savingFolderAccess, setSavingFolderAccess] = useState(false);
  const [accessRequestFolder, setAccessRequestFolder] = useState<ProjectFolder | null>(null);
  const [requestingAccess, setRequestingAccess] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      if (mq.matches) setViewMode("list");
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
  const detailFile = useMemo(
    () =>
      project && detailFileId
        ? (project.files.find((item) => item.id === detailFileId) ?? null)
        : null,
    [project, detailFileId],
  );
  const selectedFolder = useMemo(
    () =>
      project && folderId ? (project.folders.find((item) => item.id === folderId) ?? null) : null,
    [project, folderId],
  );

  useEffect(() => {
    if (!project) return;
    const deepVersionId = searchParams.get("fileVersionId");
    if (!deepVersionId) return;
    const hit = project.files.find((file) =>
      file.versions.some((version) => version.id === deepVersionId),
    );
    if (!hit) return;
    const picked = hit.versions.find((version) => version.id === deepVersionId);
    if (picked) {
      setFileVersionPick((prev) => ({ ...prev, [hit.id]: picked.version }));
    }
    setDetailFileId(hit.id);
  }, [project, searchParams]);

  useEffect(() => {
    if (!selectedFolder || !folderAccessOpen) return;
    const mode = selectedFolder.accessMode === "SELECTED_USERS" ? "selected" : "all";
    setFolderAccessMode(mode);
    setFolderAccessUserIds(selectedFolder.allowedUserIds ?? []);
  }, [selectedFolder, folderAccessOpen]);

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

  const filteredSubfolders = useMemo(() => {
    if (!searchQuery.trim()) return subfolders;
    return filterByName(project?.folders ?? [], searchQuery).filter(
      (folder) => folder.parentId === folderId,
    );
  }, [searchQuery, subfolders, project, folderId]);
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return sortedFiles;
    return filterByName(project?.files ?? [], searchQuery).filter(
      (file) => file.folderId === folderId,
    );
  }, [searchQuery, sortedFiles, project, folderId]);

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
    await queryClient.invalidateQueries({ queryKey: qk.projectAuditRoot(projectId) });
    await queryClient.invalidateQueries({ queryKey: qk.me() });
  }, [queryClient, wid, projectId]);

  const bindDragStartMove = useCallback((e: React.DragEvent, payload: MoveDragPayload) => {
    e.dataTransfer.setData(MOVE_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const moveExplorerItem = useCallback(
    async (payload: MoveDragPayload, targetFolderId: string | null) => {
      if (!canManage) return;
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
    [canManage, wid, project, projectId, queryClient, invalidate],
  );

  function enqueueUploads(files: File[], targetFolderId: string | null = folderId) {
    if (!canUpload) {
      toast.error("You do not have permission to upload drawings.");
      return;
    }
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

  function openFileInViewer(f: CloudFile) {
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

  function openFileDetails(file: CloudFile) {
    setDetailFileId(file.id);
  }

  function openNewFolderModal() {
    setFolderName("");
    setNewFolderAccessMode("all");
    setNewFolderAccessUserIds([]);
    setFolderModal(true);
  }

  function closeNewFolderModal() {
    if (saving) return;
    setFolderModal(false);
  }

  async function onCreateFolder() {
    if (!canManage) return;
    if (!wid || !folderName.trim()) return;
    setSaving(true);
    const tempId = `optimistic-${nanoid()}`;
    const optimisticAccessMode = newFolderAccessMode === "selected" ? "SELECTED_USERS" : "ALL";
    const optimisticAllowedUserIds =
      newFolderAccessMode === "selected" ? [...newFolderAccessUserIds] : [];
    const opt: ProjectFolder = {
      id: tempId,
      name: folderName.trim(),
      parentId: folderId,
      projectId,
      accessMode: optimisticAccessMode,
      allowedUserIds: optimisticAllowedUserIds,
      canAccess: true,
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
          accessMode: optimisticAccessMode,
          allowedUserIds: optimisticAllowedUserIds,
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
      setNewFolderAccessMode("all");
      setNewFolderAccessUserIds([]);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveFolderAccess() {
    if (!selectedFolder) return;
    setSavingFolderAccess(true);
    try {
      await patchFolderAccess(projectId, selectedFolder.id, {
        mode: folderAccessMode,
        userIds: folderAccessMode === "selected" ? folderAccessUserIds : [],
      });
      await invalidate();
      setFolderAccessOpen(false);
      toast.success("Folder access updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update folder access.");
    } finally {
      setSavingFolderAccess(false);
    }
  }

  async function onRequestFolderAccess() {
    if (!accessRequestFolder) return;
    setRequestingAccess(true);
    try {
      await requestFolderAccess(projectId, accessRequestFolder.id);
      toast.success("Access request sent to project admins.");
      setAccessRequestFolder(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send access request.");
    } finally {
      setRequestingAccess(false);
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

  async function downloadFolder(folder: ProjectFolder) {
    const key = `folder-download:${folder.id}`;
    setDownloadingKey(key);
    try {
      const href = apiUrl(`/api/v1/projects/${projectId}/folders/${folder.id}/download`);
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Folder download failed.");
    } finally {
      setDownloadingKey(null);
    }
  }

  function requestDeleteFile(file: CloudFile) {
    if (!canManage) return;
    setDeleteConfirmValue("");
    setPendingDeletion({ type: "file", file });
  }

  function requestDeleteFolder(folder: ProjectFolder) {
    if (!canManage) return;
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
      const sv = sortedVersions(file);
      const fallback = sv[0]?.version ?? 1;
      const pick = fileVersionPick[file.id];
      const versionToDelete = pick != null && sv.some((x) => x.version === pick) ? pick : fallback;
      const multiVersion = sv.length > 1;

      setDeletingKey(`file:${file.id}`);
      if (multiVersion) {
        removeFileVersionFromProjectCache(queryClient, wid, projectId, file.id, versionToDelete);
      } else {
        removeFileFromProjectCache(queryClient, wid, projectId, file.id);
      }
      try {
        const q = multiVersion ? `?version=${encodeURIComponent(String(versionToDelete))}` : "";
        const res = await fetch(apiUrl(`/api/v1/projects/${projectId}/files/${file.id}${q}`), {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          toast.error("Could not delete file.");
          await invalidate();
        } else {
          setFileVersionPick((p) => {
            if (!(file.id in p)) return p;
            const next = { ...p };
            delete next[file.id];
            return next;
          });
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
        {isPro
          ? "Project not found."
          : "Files & drawings require a Pro plan. Upgrade this workspace to access documents."}
      </div>
    );
  }

  if (!canViewDrawings) {
    return (
      <div className="rounded-2xl border border-[var(--enterprise-border)] bg-white p-10 text-center text-sm text-[var(--enterprise-text-muted)] shadow-sm">
        Drawings are hidden for clients in this project.
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
        disabled={!canUpload}
        aria-label="Upload files"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[var(--enterprise-shadow-card)]">
        <FileExplorerTopBar
          breadcrumbs={breadcrumbItems}
          onNavigate={openFolderOrRequest}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onNewFolder={() =>
            canManage ? openNewFolderModal() : toast.error("Admin access required.")
          }
          folderAccess={
            canManage && selectedFolder
              ? {
                  summary:
                    selectedFolder.accessMode === "SELECTED_USERS"
                      ? `Access · ${selectedFolder.allowedUserIds?.length ?? 0} selected`
                      : "Access · all users",
                  onClick: () => setFolderAccessOpen(true),
                }
              : undefined
          }
          uploadLabel="Upload files"
          uploadDisabled={!canUpload}
          uploading={false}
          uploadInputId={UPLOAD_INPUT_ID}
          onImportFromCloud={canUpload ? () => setCloudImportOpen(true) : undefined}
          onOpenFolderTree={() => setMobileFolderTreeOpen(true)}
        />

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 shrink-0 flex-col border-r border-slate-200/70 bg-slate-50 lg:flex">
            <FileExplorerTree
              className="h-full"
              folders={project.folders}
              rootLabel={project.name}
              selectedFolderId={folderId}
              expanded={treeExpanded}
              onToggleExpand={toggleTreeExpand}
              onSelectFolder={openFolderOrRequest}
              dropTargetKey={dropTargetKey}
              onDragOverFolder={handleDragOverFolder}
              onDragLeaveFolder={handleDragLeaveFolder}
              onDropOnFolder={handleDropOnFolder}
              onDragStartMove={
                canManage
                  ? (e, fid) => bindDragStartMove(e, { kind: "folder", id: fid })
                  : undefined
              }
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
            onOpenFolder={openFolderOrRequest}
            onOpenFile={openFileDetails}
            onOpenViewer={openFileInViewer}
            onDeleteFolder={requestDeleteFolder}
            onDeleteFile={requestDeleteFile}
            onDownloadFile={(f) => void downloadFile(f)}
            onDownloadFolder={(folder) => void downloadFolder(folder)}
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
            uploadDisabled={!canUpload}
            onDragStartMove={canManage ? bindDragStartMove : undefined}
            fileVersionPick={fileVersionPick}
            onFileVersionPick={(fid, ver) => setFileVersionPick((p) => ({ ...p, [fid]: ver }))}
          />
        </div>
      </div>

      {mobileFolderTreeOpen ? (
        <>
          <button
            type="button"
            aria-label="Close folder list"
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileFolderTreeOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-[70] flex w-[min(100%,20rem)] flex-col border-r border-slate-200/80 bg-slate-50 shadow-xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Folders"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">Folders</p>
              <button
                type="button"
                onClick={() => setMobileFolderTreeOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <FileExplorerTree
              className="min-h-0 flex-1"
              showSectionLabel={false}
              folders={project.folders}
              rootLabel={project.name}
              selectedFolderId={folderId}
              expanded={treeExpanded}
              onToggleExpand={toggleTreeExpand}
              onSelectFolder={openFolderOrRequest}
              dropTargetKey={dropTargetKey}
              onDragOverFolder={handleDragOverFolder}
              onDragLeaveFolder={handleDragLeaveFolder}
              onDropOnFolder={handleDropOnFolder}
              onDragStartMove={
                canManage
                  ? (e, fid) => bindDragStartMove(e, { kind: "folder", id: fid })
                  : undefined
              }
            />
          </div>
        </>
      ) : null}

      <FileExplorerDeleteConfirmDialog
        open={Boolean(pendingDeletion)}
        targetName={
          pendingDeletion?.type === "file"
            ? pendingDeletion.file.name
            : (pendingDeletion?.folder.name ?? "")
        }
        targetType={pendingDeletion?.type ?? "file"}
        fileRevisionToDelete={
          pendingDeletion?.type === "file"
            ? (() => {
                const f = pendingDeletion.file;
                const sv = sortedVersions(f);
                if (sv.length <= 1) return null;
                const fb = sv[0]?.version ?? 1;
                const pk = fileVersionPick[f.id];
                return pk != null && sv.some((x) => x.version === pk) ? pk : fb;
              })()
            : null
        }
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
      <FileDetailSlideOver
        open={Boolean(detailFile)}
        onClose={() => setDetailFileId(null)}
        projectId={projectId}
        file={detailFile}
        selectedVersion={detailFile ? (fileVersionPick[detailFile.id] ?? null) : null}
        onSelectVersion={(version) => {
          if (!detailFile) return;
          setFileVersionPick((prev) => ({ ...prev, [detailFile.id]: version }));
        }}
        onOpenFile={openFileInViewer}
        onDownloadFile={(file) => void downloadFile(file)}
        currentUserId={me?.user.id}
      />

      <EnterpriseResponsiveDialog
        open={folderModal && canManage}
        onClose={closeNewFolderModal}
        ariaLabelledBy="project-files-new-folder-title"
        panelClassName="max-w-xl rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-0"
        bodyClassName="p-0"
        footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3 lg:px-5"
        footer={
          <>
            <button
              type="button"
              onClick={closeNewFolderModal}
              className="rounded-lg border border-[var(--enterprise-border)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onCreateFolder()}
              disabled={saving || !folderName.trim()}
              className="rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create folder"}
            </button>
          </>
        }
      >
        <div className="border-b border-[var(--enterprise-border)] px-4 py-4 lg:px-5">
          <h2
            id="project-files-new-folder-title"
            className="inline-flex items-center gap-2 text-base font-semibold text-[var(--enterprise-text)]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
              <FolderPlus className="h-4 w-4" aria-hidden />
            </span>
            New folder
          </h2>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            Create a folder and set who can access it.
          </p>
        </div>
        <div className="space-y-4 px-4 py-4 lg:px-5">
          <div className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-white p-3">
            <label
              htmlFor="project-files-folder-name"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden />
              Folder name
            </label>
            <input
              id="project-files-folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onCreateFolder();
                }
              }}
              className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
              placeholder="e.g. Architectural"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-slate-50/70 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Access control
            </p>
            <label className="flex items-center gap-2 rounded-lg border border-transparent bg-white/70 px-2.5 py-2 text-sm text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-border)]">
              <input
                type="radio"
                checked={newFolderAccessMode === "all"}
                onChange={() => setNewFolderAccessMode("all")}
              />
              <Globe2 className="h-4 w-4 text-slate-500" aria-hidden />
              <span>All users can use this folder</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-transparent bg-white/70 px-2.5 py-2 text-sm text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-border)]">
              <input
                type="radio"
                checked={newFolderAccessMode === "selected"}
                onChange={() => setNewFolderAccessMode("selected")}
              />
              <Users className="h-4 w-4 text-slate-500" aria-hidden />
              <span>Only selected users can view this folder</span>
            </label>
          </div>

          {newFolderAccessMode === "selected" ? (
            <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-2">
              <p className="inline-flex items-center gap-1.5 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Select users
              </p>
              <div className="enterprise-scrollbar max-h-64 space-y-1 overflow-y-auto">
                {(projectTeam?.members ?? []).map((member) => {
                  const selected = newFolderAccessUserIds.includes(member.userId);
                  return (
                    <label
                      key={`new-folder-access-${member.userId}`}
                      className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition ${
                        selected
                          ? "border-[var(--enterprise-primary)]/35 bg-[var(--enterprise-primary-soft)]/60"
                          : "border-transparent hover:border-[var(--enterprise-border)] hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          setNewFolderAccessUserIds((prev) =>
                            e.target.checked
                              ? [...new Set([...prev, member.userId])]
                              : prev.filter((id) => id !== member.userId),
                          );
                        }}
                      />
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || member.email || "User avatar"}
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                          {userInitials(member.name, member.email)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--enterprise-text)]">
                          {member.name || "Unnamed user"}
                        </span>
                        <span className="block truncate text-xs text-[var(--enterprise-text-muted)]">
                          {member.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {(projectTeam?.members ?? []).length === 0 ? (
                  <p className="px-2 py-2 text-sm text-[var(--enterprise-text-muted)]">
                    No team members available.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </EnterpriseResponsiveDialog>
      <EnterpriseResponsiveDialog
        open={folderAccessOpen && Boolean(selectedFolder)}
        onClose={() => setFolderAccessOpen(false)}
        ariaLabelledBy="project-files-folder-access-title"
        panelClassName="max-w-xl rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-0"
        bodyClassName="p-0"
        footerClassName="border-t border-[var(--enterprise-border)] px-4 py-3 lg:px-5"
        footer={
          <>
            <button
              type="button"
              onClick={() => setFolderAccessOpen(false)}
              className="rounded-lg border border-[var(--enterprise-border)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSaveFolderAccess()}
              disabled={savingFolderAccess}
              className="rounded-lg bg-[var(--enterprise-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingFolderAccess ? "Saving..." : "Save access"}
            </button>
          </>
        }
      >
        <div className="border-b border-[var(--enterprise-border)] px-4 py-4 lg:px-5">
          <h2
            id="project-files-folder-access-title"
            className="inline-flex items-center gap-2 text-base font-semibold text-[var(--enterprise-text)]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            Folder access
          </h2>
          <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
            Control who can view{" "}
            <span className="font-medium text-[var(--enterprise-text)]">
              {selectedFolder?.name}
            </span>
            .
          </p>
        </div>

        <div className="space-y-4 px-4 py-4 lg:px-5">
          <div className="space-y-2 rounded-xl border border-[var(--enterprise-border)] bg-slate-50/70 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Access control
            </p>
            <label className="flex items-center gap-2 rounded-lg border border-transparent bg-white/70 px-2.5 py-2 text-sm text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-border)]">
              <input
                type="radio"
                checked={folderAccessMode === "all"}
                onChange={() => setFolderAccessMode("all")}
              />
              <Globe2 className="h-4 w-4 text-slate-500" aria-hidden />
              <span>All users can use this folder</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-transparent bg-white/70 px-2.5 py-2 text-sm text-[var(--enterprise-text)] transition hover:border-[var(--enterprise-border)]">
              <input
                type="radio"
                checked={folderAccessMode === "selected"}
                onChange={() => setFolderAccessMode("selected")}
              />
              <Users className="h-4 w-4 text-slate-500" aria-hidden />
              <span>Only selected users can view this folder</span>
            </label>
          </div>

          {folderAccessMode === "selected" ? (
            <div className="rounded-xl border border-[var(--enterprise-border)] bg-white p-2">
              <p className="inline-flex items-center gap-1.5 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--enterprise-text-muted)]">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Select users
              </p>
              <div className="enterprise-scrollbar max-h-72 space-y-1 overflow-y-auto">
                {(projectTeam?.members ?? []).map((member) => {
                  const selected = folderAccessUserIds.includes(member.userId);
                  return (
                    <label
                      key={member.userId}
                      className={`flex items-center gap-3 rounded-lg border px-2.5 py-2 text-sm transition ${
                        selected
                          ? "border-[var(--enterprise-primary)]/35 bg-[var(--enterprise-primary-soft)]/60"
                          : "border-transparent hover:border-[var(--enterprise-border)] hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => {
                          setFolderAccessUserIds((prev) =>
                            event.target.checked
                              ? Array.from(new Set([...prev, member.userId]))
                              : prev.filter((id) => id !== member.userId),
                          );
                        }}
                      />
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={`${member.name} avatar`}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--enterprise-primary-soft)] text-xs font-semibold text-[var(--enterprise-primary)]">
                          {userInitials(member.name, member.email)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--enterprise-text)]">
                          {member.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--enterprise-text-muted)]">
                          {member.email}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </EnterpriseResponsiveDialog>
      <EnterpriseResponsiveDialog
        open={Boolean(accessRequestFolder)}
        onClose={() => setAccessRequestFolder(null)}
        ariaLabelledBy="project-files-request-access-title"
        panelClassName="max-w-md rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAccessRequestFolder(null)}
              className="rounded-lg border border-[var(--enterprise-border)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onRequestFolderAccess()}
              disabled={requestingAccess}
              className="rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {requestingAccess ? "Sending..." : "Request access"}
            </button>
          </>
        }
      >
        <h2
          id="project-files-request-access-title"
          className="text-base font-semibold text-[var(--enterprise-text)]"
        >
          Folder access needed
        </h2>
        <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
          You do not currently have permission to open{" "}
          <span className="font-medium text-[var(--enterprise-text)]">
            {accessRequestFolder?.name}
          </span>
          . Send a request and project admins will be notified.
        </p>
      </EnterpriseResponsiveDialog>
      {wid && canUpload ? (
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
          open={cloudImportOpen && canUpload}
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

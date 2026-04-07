"use client";

import { apiUrl } from "@/lib/api-url";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Trash2,
  Upload,
  FileText,
} from "lucide-react";
import {
  applyFolderStructure,
  fetchFolderStructureTemplates,
  fetchProjects,
  ProRequiredError,
} from "@/lib/api-client";
import { downloadProjectFileVersion } from "@/lib/downloadProjectFile";
import { getLastProjectId, setLastProjectId } from "@/lib/lastProject";
import {
  addFolderToProjectCache,
  mergeUploadedFileIntoProject,
  removeFileFromProjectCache,
  removeFolderSubtreeFromProjectCache,
  replaceOptimisticFolder,
} from "@/lib/projectsCache";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { guessFileMimeType, isImageThumbnailFile, isPdfFile } from "@/lib/isPdfFile";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { qk } from "@/lib/queryKeys";
import { nanoid } from "nanoid";
import type { ProjectStageValue } from "@/lib/projectStage";
import type { ProjectCurrencyCode } from "@/lib/projectCurrency";
import type { ProjectMeasurementSystem } from "@/lib/projectMeasurement";
import type { CloudFile, FileVersion, Folder as ProjectFolder, Project } from "@/types/projects";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { useEnterpriseWorkspace } from "./EnterpriseWorkspaceContext";
import { EnterpriseSlideOver } from "./EnterpriseSlideOver";
import {
  NewProjectDialog,
  type InitialFolderStructureOption,
  type NewProjectDialogValues,
} from "./NewProjectDialog";
import { ProjectLogo } from "./ProjectLogo";
import { ProjectProgressBar } from "./ProjectProgressBar";
import { ProjectStageBadge } from "./ProjectStageBadge";
import { PdfFileThumbnail } from "./PdfFileThumbnail";
import { ProjectFileImageLightbox } from "./ProjectFileImageLightbox";

function formatBytes(n: string | number | bigint): string {
  const v = typeof n === "bigint" ? Number(n) : Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  return `${(v / 1024 ** 3).toFixed(2)} GB`;
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Path from root to `folderId` (exclusive of root). */
function folderBreadcrumbPath(folderId: string | null, folders: ProjectFolder[]): ProjectFolder[] {
  if (!folderId) return [];
  const map = new Map(folders.map((f) => [f.id, f]));
  const path: ProjectFolder[] = [];
  let cur: string | null = folderId;
  while (cur) {
    const f = map.get(cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parentId;
  }
  return path;
}

const VIEW_STORAGE_KEY = "plansync-projects-view-mode";

function sortedFileVersions(f: CloudFile): FileVersion[] {
  return [...f.versions].sort((a, b) => b.version - a.version);
}

export function ProjectsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { primary, loading: ctxLoading } = useEnterpriseWorkspace();
  const wid = primary?.workspace.id;
  const isAdmin = primary?.role === "ADMIN" || primary?.role === "SUPER_ADMIN";
  const isPro = isWorkspaceProClient(primary?.workspace.subscriptionStatus);

  const {
    data: projects = [],
    isPending: projectsPending,
    error: projectsQueryError,
  } = useQuery({
    queryKey: qk.projects(wid ?? ""),
    queryFn: () => fetchProjects(wid!),
    enabled: Boolean(wid && isPro),
  });

  const { data: folderStructureTemplates = [] } = useQuery({
    queryKey: qk.folderStructureTemplates(wid ?? ""),
    queryFn: () => fetchFolderStructureTemplates(wid!),
    enabled: Boolean(wid && isPro),
  });

  const invalidateProjectsAndMe = useCallback(async () => {
    if (wid) {
      await queryClient.invalidateQueries({ queryKey: qk.projects(wid) });
      await queryClient.invalidateQueries({ queryKey: qk.dashboard(wid) });
    }
    await queryClient.invalidateQueries({ queryKey: qk.me() });
  }, [queryClient, wid]);

  /** Refresh workspace usage + dashboard without refetching the full project tree. */
  const invalidateMeAndDashboard = useCallback(async () => {
    if (wid) await queryClient.invalidateQueries({ queryKey: qk.dashboard(wid) });
    await queryClient.invalidateQueries({ queryKey: qk.me() });
  }, [queryClient, wid]);

  const resetNewProjectForm = useCallback(() => {
    setProjectName("");
    setStartDate("");
    setEndDate("");
    setProjectNumber("");
    setLocalBudget("");
    setProjectSize("");
    setProjectType("");
    setLocation("");
    setWebsiteUrl("");
    setProjectStage("NOT_STARTED");
    setProgressPercent(0);
    setCurrency("USD");
    setMeasurementSystem("METRIC");
    setInitialFolderStructure("none");
    setFolderTemplateId("");
    setCopyFromProjectId("");
  }, []);

  const onNewProjectFieldChange = useCallback(
    (field: keyof NewProjectDialogValues, value: string | number) => {
      if (field === "progressPercent") {
        setProgressPercent(typeof value === "number" ? value : Number(value));
        return;
      }
      if (field === "projectStage") {
        setProjectStage(value as ProjectStageValue);
        return;
      }
      if (field === "currency") {
        setCurrency(value as ProjectCurrencyCode);
        return;
      }
      if (field === "measurementSystem") {
        setMeasurementSystem(value as ProjectMeasurementSystem);
        return;
      }
      if (field === "initialFolderStructure") {
        setInitialFolderStructure(value as InitialFolderStructureOption);
        return;
      }
      if (field === "folderTemplateId") {
        setFolderTemplateId(String(value));
        return;
      }
      if (field === "copyFromProjectId") {
        setCopyFromProjectId(String(value));
        return;
      }
      const v = String(value);
      switch (field) {
        case "projectName":
          setProjectName(v);
          break;
        case "startDate":
          setStartDate(v);
          break;
        case "endDate":
          setEndDate(v);
          break;
        case "projectNumber":
          setProjectNumber(v);
          break;
        case "localBudget":
          setLocalBudget(v);
          break;
        case "projectSize":
          setProjectSize(v);
          break;
        case "projectType":
          setProjectType(v);
          break;
        case "location":
          setLocation(v);
          break;
        case "websiteUrl":
          setWebsiteUrl(v);
          break;
        default:
          break;
      }
    },
    [],
  );

  const loadError = useMemo(() => {
    if (!projectsQueryError) return null;
    if (projectsQueryError instanceof ProRequiredError) {
      return "Cloud projects require an active Pro subscription.";
    }
    return projectsQueryError instanceof Error
      ? projectsQueryError.message
      : "Could not load projects.";
  }, [projectsQueryError]);

  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [projectModal, setProjectModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [currency, setCurrency] = useState<ProjectCurrencyCode>("USD");
  const [measurementSystem, setMeasurementSystem] = useState<ProjectMeasurementSystem>("METRIC");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [localBudget, setLocalBudget] = useState("");
  const [projectSize, setProjectSize] = useState("");
  const [projectType, setProjectType] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [projectStage, setProjectStage] = useState<ProjectStageValue>("NOT_STARTED");
  const [progressPercent, setProgressPercent] = useState(0);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [initialFolderStructure, setInitialFolderStructure] =
    useState<InitialFolderStructureOption>("none");
  const [folderTemplateId, setFolderTemplateId] = useState("");
  const [copyFromProjectId, setCopyFromProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  /** Which revision to open in the viewer when a file has multiple versions */
  const [versionPick, setVersionPick] = useState<Record<string, number>>({});
  const [imageLightbox, setImageLightbox] = useState<{
    fileId: string;
    fileName: string;
    version: number;
  } | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "list" || v === "grid") setViewMode(v);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!projects.length) return;
    setSelectedProjectId((prev) => {
      if (prev && projects.some((p) => p.id === prev)) return prev;
      const stored = getLastProjectId();
      if (stored && projects.some((p) => p.id === stored)) return stored;
      return projects[0]?.id ?? null;
    });
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId) setLastProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const visibleFiles = useMemo(() => {
    if (!selectedProject) return [];
    return selectedProject.files.filter((f) => f.folderId === selectedFolderId);
  }, [selectedProject, selectedFolderId]);

  const subfolders = useMemo(() => {
    const list = selectedProject?.folders.filter((f) => f.parentId === selectedFolderId) ?? [];
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [selectedProject, selectedFolderId]);

  const sortedFiles = useMemo(
    () =>
      [...visibleFiles].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [visibleFiles],
  );

  const breadcrumb = useMemo(
    () => (selectedProject ? folderBreadcrumbPath(selectedFolderId, selectedProject.folders) : []),
    [selectedProject, selectedFolderId],
  );

  useEffect(() => {
    if (folderStructureTemplates[0]?.id && !folderTemplateId) {
      setFolderTemplateId(folderStructureTemplates[0].id);
    }
  }, [folderStructureTemplates, folderTemplateId]);

  useEffect(() => {
    if (projects[0]?.id && !copyFromProjectId) {
      setCopyFromProjectId(projects[0].id);
    }
  }, [projects, copyFromProjectId]);

  const itemCount = subfolders.length + sortedFiles.length;

  async function onCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!wid || !projectName.trim() || !startDate || !endDate || !isAdmin) return;
    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const ifs = initialFolderStructure;
    const tplId = folderTemplateId;
    const copyId = copyFromProjectId;
    try {
      const res = await fetch(apiUrl(`/api/v1/workspaces/${wid}/projects`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          startDate,
          endDate,
          currency,
          measurementSystem,
          projectNumber: projectNumber.trim() || undefined,
          localBudget: localBudget.trim() || undefined,
          projectSize: projectSize.trim() || undefined,
          projectType: projectType.trim() || undefined,
          location: location.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          stage: projectStage,
          progressPercent,
        }),
      });
      if (res.status === 402) {
        setError("Pro subscription required to create projects.");
        return;
      }
      if (!res.ok) {
        setError("Could not create project.");
        return;
      }
      const p = (await res.json()) as Project;
      setProjectModal(false);
      resetNewProjectForm();
      setSelectedProjectId(p.id);
      await invalidateProjectsAndMe();

      if (ifs === "template" && tplId) {
        try {
          await applyFolderStructure(p.id, {
            targetParentId: null,
            source: { kind: "template", templateId: tplId },
          });
        } catch (err) {
          if (err instanceof ProRequiredError) {
            toast.error("Pro subscription required to apply folder template.");
          } else {
            toast.error(
              err instanceof Error ? err.message : "Folder template could not be applied.",
            );
          }
        }
      } else if (ifs === "copy" && copyId) {
        try {
          await applyFolderStructure(p.id, {
            targetParentId: null,
            source: { kind: "project", sourceProjectId: copyId },
          });
        } catch (err) {
          if (err instanceof ProRequiredError) {
            toast.error("Pro subscription required to copy folder structure.");
          } else {
            toast.error(
              err instanceof Error ? err.message : "Folder structure could not be copied.",
            );
          }
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function onCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!wid || !selectedProjectId || !folderName.trim()) return;
    setSaving(true);
    setError(null);
    const tempId = `optimistic-${nanoid()}`;
    const optimisticFolder: ProjectFolder = {
      id: tempId,
      name: folderName.trim(),
      parentId: selectedFolderId,
      projectId: selectedProjectId,
      updatedAt: new Date().toISOString(),
    };
    const snapshot = queryClient.getQueryData<Project[]>(qk.projects(wid));
    addFolderToProjectCache(queryClient, wid, selectedProjectId, optimisticFolder);
    try {
      const res = await fetch(apiUrl(`/api/v1/projects/${selectedProjectId}/folders`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName.trim(),
          parentId: selectedFolderId ?? undefined,
        }),
      });
      if (res.status === 402) {
        if (snapshot !== undefined) queryClient.setQueryData(qk.projects(wid), snapshot);
        setError("Pro subscription required.");
        return;
      }
      if (!res.ok) {
        if (snapshot !== undefined) queryClient.setQueryData(qk.projects(wid), snapshot);
        setError("Could not create folder.");
        return;
      }
      const folder = (await res.json()) as ProjectFolder;
      replaceOptimisticFolder(queryClient, wid, selectedProjectId, tempId, folder);
      setFolderModal(false);
      setFolderName("");
      await invalidateMeAndDashboard();
      await queryClient.invalidateQueries({ queryKey: qk.projectAudit(selectedProjectId) });
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!wid || !selectedProjectId) {
      toast.error("Select a project first.");
      return;
    }
    /** Matches backend `MAX_DIRECT_UPLOAD_BYTES` default (same-origin upload avoids S3 CORS). */
    const maxDirect = 100 * 1024 * 1024;
    setUploading(true);
    setError(null);
    try {
      await toast.promise(
        (async () => {
          let usePresign = file.size > maxDirect;

          if (!usePresign) {
            const fd = new FormData();
            fd.append("workspaceId", wid);
            fd.append("projectId", selectedProjectId);
            if (selectedFolderId) fd.append("folderId", selectedFolderId);
            fd.append("fileName", file.name);
            fd.append("file", file);
            const direct = await fetch(apiUrl("/api/v1/files/upload"), {
              method: "POST",
              credentials: "include",
              body: fd,
            });
            if (direct.status === 413) {
              usePresign = true;
            } else if (direct.status === 503) {
              const dj = (await direct.json().catch(() => ({}))) as { error?: string };
              throw new Error(dj.error ?? "S3 is not configured on the server.");
            } else if (direct.status === 402) {
              throw new Error("Pro subscription required for uploads.");
            } else if (direct.ok) {
              const data = (await direct.json()) as {
                file: {
                  id: string;
                  name: string;
                  mimeType: string;
                  folderId: string | null;
                  updatedAt?: string;
                };
                fileVersion: FileVersion;
              };
              mergeUploadedFileIntoProject(
                queryClient,
                wid,
                selectedProjectId,
                data.file,
                data.fileVersion,
              );
              await invalidateMeAndDashboard();
              await queryClient.invalidateQueries({ queryKey: qk.projectAudit(selectedProjectId) });
              return;
            } else {
              const dj = (await direct.json().catch(() => ({}))) as { error?: string };
              throw new Error(dj.error ?? "Could not upload file.");
            }
          }

          const pres = await fetch(apiUrl("/api/v1/files/presign-upload"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: wid,
              projectId: selectedProjectId,
              folderId: selectedFolderId ?? undefined,
              fileName: file.name,
              contentType: guessFileMimeType(file),
              sizeBytes: file.size,
            }),
          });
          const pj = (await pres.json().catch(() => ({}))) as {
            uploadUrl?: string;
            key?: string;
            fileId?: string;
            error?: unknown;
          };
          if (pres.status === 503) {
            throw new Error(
              typeof pj.error === "string" ? pj.error : "S3 is not configured on the server.",
            );
          }
          if (pres.status === 402) {
            throw new Error("Pro subscription required for uploads.");
          }
          if (!pres.ok || !pj.uploadUrl || !pj.key || !pj.fileId) {
            throw new Error("Could not start upload.");
          }
          const put = await fetch(pj.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": guessFileMimeType(file) },
          });
          if (!put.ok) {
            throw new Error("Upload to storage failed. Check S3 CORS and credentials.");
          }
          const done = await fetch(apiUrl("/api/v1/files/complete-upload"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId: wid,
              projectId: selectedProjectId,
              folderId: selectedFolderId ?? undefined,
              fileName: file.name,
              fileId: pj.fileId,
              s3Key: pj.key,
              sizeBytes: String(file.size),
              mimeType: guessFileMimeType(file),
            }),
          });
          if (!done.ok) {
            throw new Error("Could not finalize upload.");
          }
          const completed = (await done.json()) as {
            file: {
              id: string;
              name: string;
              mimeType: string;
              folderId: string | null;
              updatedAt?: string;
            };
            fileVersion: FileVersion;
          };
          mergeUploadedFileIntoProject(
            queryClient,
            wid,
            selectedProjectId,
            completed.file,
            completed.fileVersion,
          );
          await invalidateMeAndDashboard();
          await queryClient.invalidateQueries({ queryKey: qk.projectAudit(selectedProjectId) });
        })(),
        {
          loading: `Uploading ${file.name}…`,
          description:
            "You can navigate elsewhere in the app — we'll notify you here when the upload finishes.",
          success: () => `Upload complete — ${file.name} is ready in this project.`,
          error: (err) => {
            const raw =
              err instanceof TypeError &&
              (err.message === "Failed to fetch" || err.message.includes("fetch"))
                ? "Could not reach the API or storage. If the API is up and you still see this on large files, the bucket may need CORS allowing PUT from this origin — see docs/s3-setup.md."
                : err instanceof Error
                  ? err.message
                  : "Upload failed.";
            return raw;
          },
        },
      );
    } finally {
      setUploading(false);
    }
  }

  function getSelectedVersion(f: CloudFile): number {
    const sorted = sortedFileVersions(f);
    const fallback = sorted[0]?.version ?? 1;
    const pick = versionPick[f.id];
    if (pick != null && sorted.some((x) => x.version === pick)) return pick;
    return fallback;
  }

  async function downloadFile(f: CloudFile) {
    const sorted = sortedFileVersions(f);
    const v = getSelectedVersion(f);
    const key = `file:${f.id}`;
    setDownloadingKey(key);
    try {
      await downloadProjectFileVersion({
        fileId: f.id,
        fileName: f.name,
        version: v,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadingKey(null);
    }
  }

  function openFile(f: CloudFile, versionOverride?: number) {
    const sorted = sortedFileVersions(f);
    const v = versionOverride ?? getSelectedVersion(f);
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

    const q = new URLSearchParams({
      fileId: f.id,
      name: f.name,
    });
    if (selectedProjectId) q.set("projectId", selectedProjectId);
    if (sorted.length > 0) q.set("version", String(v));
    if (verRow?.id) q.set("fileVersionId", verRow.id);
    router.push(`/viewer?${q.toString()}`);
  }

  async function deleteFolder(folder: ProjectFolder) {
    if (!wid || !selectedProjectId) return;
    if (!confirm(`Delete folder "${folder.name}" and everything inside? This cannot be undone.`)) {
      return;
    }
    const key = `folder:${folder.id}`;
    setDeletingKey(key);
    setError(null);
    const snapshot = queryClient.getQueryData<Project[]>(qk.projects(wid));
    const prevSelectedFolderId = selectedFolderId;
    removeFolderSubtreeFromProjectCache(queryClient, wid, selectedProjectId, folder.id);
    if (selectedFolderId === folder.id) setSelectedFolderId(folder.parentId ?? null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/projects/${selectedProjectId}/folders/${folder.id}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (res.status === 402) {
        if (snapshot !== undefined) queryClient.setQueryData(qk.projects(wid), snapshot);
        setSelectedFolderId(prevSelectedFolderId);
        setError("Pro subscription required.");
        return;
      }
      if (!res.ok) {
        if (snapshot !== undefined) queryClient.setQueryData(qk.projects(wid), snapshot);
        setSelectedFolderId(prevSelectedFolderId);
        setError("Could not delete folder.");
        return;
      }
      await invalidateMeAndDashboard();
      await queryClient.invalidateQueries({ queryKey: qk.projectAudit(selectedProjectId) });
    } finally {
      setDeletingKey(null);
    }
  }

  async function deleteFile(f: CloudFile) {
    if (!wid || !selectedProjectId) return;
    if (!confirm(`Delete "${f.name}" and all of its versions? This cannot be undone.`)) {
      return;
    }
    const key = `file:${f.id}`;
    setDeletingKey(key);
    setError(null);
    const snapshot = queryClient.getQueryData<Project[]>(qk.projects(wid));
    removeFileFromProjectCache(queryClient, wid, selectedProjectId, f.id);
    try {
      const res = await fetch(apiUrl(`/api/v1/projects/${selectedProjectId}/files/${f.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 402) {
        if (snapshot !== undefined) queryClient.setQueryData(qk.projects(wid), snapshot);
        setError("Pro subscription required.");
        return;
      }
      if (!res.ok) {
        if (snapshot !== undefined) queryClient.setQueryData(qk.projects(wid), snapshot);
        setError("Could not delete file.");
        return;
      }
      await invalidateMeAndDashboard();
      await queryClient.invalidateQueries({ queryKey: qk.projectAudit(selectedProjectId) });
    } finally {
      setDeletingKey(null);
    }
  }

  const displayError = error ?? loadError;

  if (ctxLoading || (Boolean(wid && isPro) && projectsPending)) {
    return (
      <div className="p-4 sm:p-6">
        <EnterpriseLoadingState message="Loading projects…" label="Loading workspace projects" />
      </div>
    );
  }

  if (!primary || !wid) {
    return (
      <div className="enterprise-card p-8 text-sm text-[var(--enterprise-text-muted)]">
        Sign in and join a workspace to manage projects.
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="enterprise-alert-warning p-6 text-sm">
        Cloud projects and file uploads require an{" "}
        <strong className="font-semibold">active Pro</strong> workspace subscription.
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col gap-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <aside className="enterprise-card w-full shrink-0 p-4 lg:w-72">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]">
              Projects
            </h2>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setProjectModal(true)}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--enterprise-primary)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)]"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            ) : null}
          </div>
          <ul className="mt-3 space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setSelectedFolderId(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg py-2 pl-3 pr-2 text-left text-[14px] font-medium transition ${
                    selectedProjectId === p.id
                      ? "border-l-4 border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)]"
                      : "text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                  }`}
                >
                  <ProjectLogo name={p.name} logoUrl={p.logoUrl} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <ProjectStageBadge stage={p.stage} className="max-w-[120px] text-[10px]" />
                      <span className="text-[10px] tabular-nums text-[var(--enterprise-text-muted)]">
                        {typeof p.progressPercent === "number" ? p.progressPercent : 0}%
                      </span>
                    </span>
                    <ProjectProgressBar
                      value={typeof p.progressPercent === "number" ? p.progressPercent : 0}
                      height={4}
                      showLabel={false}
                      className="mt-1.5 max-w-[11rem]"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {projects.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--enterprise-text-muted)]">
              {isAdmin ? "Create a project to upload drawings." : "No projects yet."}
            </p>
          ) : null}
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {displayError ? (
            <div className="enterprise-alert-danger px-3 py-2 text-sm">{displayError}</div>
          ) : null}

          {selectedProject ? (
            <>
              {uploading ? (
                <div className="flex items-start gap-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3 text-[13px] text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)]">
                  <Loader2
                    className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--enterprise-primary)]"
                    aria-hidden
                  />
                  <div>
                    <p className="font-semibold">Upload in progress</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-[var(--enterprise-text-muted)]">
                      You can keep working elsewhere in the app — we&apos;ll notify you here when
                      the file is ready.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="enterprise-card flex flex-col gap-3 px-4 py-3">
                <nav className="flex min-h-[1.5rem] flex-wrap items-center gap-1 text-sm text-[var(--enterprise-text)]">
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(null)}
                    className="rounded-md px-1.5 py-0.5 font-medium hover:bg-slate-100"
                  >
                    {selectedProject.name}
                  </button>
                  {breadcrumb.map((f) => (
                    <Fragment key={f.id}>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--enterprise-text-muted)] opacity-60" />
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(f.id)}
                        className="max-w-[200px] truncate rounded-md px-1.5 py-0.5 hover:bg-slate-100"
                      >
                        {f.name}
                      </button>
                    </Fragment>
                  ))}
                </nav>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[var(--enterprise-text-muted)]">
                    {itemCount} item{itemCount === 1 ? "" : "s"} in this folder
                    {sortedFiles.length > 0
                      ? ` · ${sortedFiles.length} file${sortedFiles.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-[var(--enterprise-border)] p-0.5">
                      <button
                        type="button"
                        title="Grid view"
                        onClick={() => setViewMode("grid")}
                        className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-slate-100 shadow-sm" : "text-[var(--enterprise-text-muted)]"}`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="List view"
                        onClick={() => setViewMode("list")}
                        className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-slate-100 shadow-sm" : "text-[var(--enterprise-text-muted)]"}`}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFolderModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-white px-3 py-2 text-xs font-medium"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      New folder
                    </button>
                    <label
                      className={`inline-flex select-none items-center gap-1.5 rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-xs font-semibold text-white transition ${
                        uploading
                          ? "pointer-events-none cursor-wait opacity-85"
                          : "cursor-pointer hover:brightness-110"
                      }`}
                      aria-busy={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {uploading ? "Uploading…" : "Upload file"}
                      <input
                        type="file"
                        className="sr-only"
                        disabled={uploading}
                        onChange={onUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="enterprise-card p-4">
                {itemCount === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)]">
                      <FileText className="h-10 w-10 opacity-90" strokeWidth={1.25} aria-hidden />
                    </div>
                    <p className="mt-4 text-base font-semibold text-[var(--enterprise-text)]">
                      No files yet
                    </p>
                    <p className="mt-1 max-w-sm text-[14px] text-[var(--enterprise-subtitle)]">
                      Upload your first file to get started
                    </p>
                    <label
                      className={`mt-6 inline-flex select-none items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
                        uploading
                          ? "pointer-events-none cursor-wait opacity-85"
                          : "cursor-pointer hover:bg-[var(--enterprise-primary-deep)]"
                      }`}
                      aria-busy={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 shrink-0" />
                      )}
                      {uploading ? "Uploading…" : "Upload file"}
                      <input
                        type="file"
                        className="sr-only"
                        disabled={uploading}
                        onChange={onUpload}
                      />
                    </label>
                  </div>
                ) : viewMode === "list" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--enterprise-border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                          <th className="pb-2 pl-2 pr-4">Name</th>
                          <th className="pb-2 pr-4">Modified</th>
                          <th className="pb-2 pr-4">Size</th>
                          <th className="pb-2 pr-4">Version</th>
                          <th className="min-w-[4.5rem] pb-2" aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {subfolders.map((fol) => (
                          <tr
                            key={fol.id}
                            className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                            onClick={() => setSelectedFolderId(fol.id)}
                          >
                            <td className="py-2.5 pl-2">
                              <span className="inline-flex items-center gap-2 font-medium text-[var(--enterprise-text)]">
                                <Folder className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]" />
                                {fol.name}
                              </span>
                            </td>
                            <td className="py-2.5 text-[var(--enterprise-text-muted)]">
                              {fol.updatedAt ? formatShortDate(fol.updatedAt) : "—"}
                            </td>
                            <td className="py-2.5 text-[var(--enterprise-text-muted)]">—</td>
                            <td className="py-2.5" aria-hidden />
                            <td className="py-2.5">
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-[var(--enterprise-text-muted)] hover:bg-red-50 hover:text-red-600"
                                disabled={deletingKey === `folder:${fol.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteFolder(fol);
                                }}
                                aria-label={`Delete folder ${fol.name}`}
                              >
                                {deletingKey === `folder:${fol.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {sortedFiles.map((f) => {
                          const sortedV = sortedFileVersions(f);
                          const sel = getSelectedVersion(f);
                          const rowVer = sortedV.find((x) => x.version === sel) ?? sortedV[0];
                          const size =
                            rowVer != null
                              ? `${formatBytes(rowVer.sizeBytes)} · v${rowVer.version}`
                              : "—";
                          return (
                            <tr
                              key={f.id}
                              className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                              onClick={() => openFile(f)}
                            >
                              <td className="py-2.5 pl-2">
                                <span className="inline-flex items-center gap-2 font-medium text-[var(--enterprise-text)]">
                                  {isPdfFile(f) ? (
                                    <PdfFileIcon className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <FileText className="h-4 w-4 shrink-0 text-[var(--enterprise-primary)]" />
                                  )}
                                  {f.name}
                                </span>
                              </td>
                              <td className="py-2.5 text-[var(--enterprise-text-muted)]">
                                {f.updatedAt ? formatShortDate(f.updatedAt) : "—"}
                              </td>
                              <td className="py-2.5 text-[var(--enterprise-text-muted)]">{size}</td>
                              <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                                {sortedV.length > 1 ? (
                                  <select
                                    aria-label={`Version for ${f.name}`}
                                    className="max-w-[140px] rounded-md border border-[var(--enterprise-border)] bg-white px-2 py-1.5 text-[12px] text-[var(--enterprise-text)]"
                                    value={String(sel)}
                                    onChange={(e) => {
                                      const n = Number(e.target.value);
                                      setVersionPick((p) => ({ ...p, [f.id]: n }));
                                    }}
                                  >
                                    {sortedV.map((ver) => (
                                      <option key={ver.version} value={ver.version}>
                                        v{ver.version}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[var(--enterprise-text-muted)]">
                                    {rowVer ? `v${rowVer.version}` : "—"}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5">
                                <div className="flex items-center justify-end gap-0.5">
                                  <button
                                    type="button"
                                    className="rounded-lg p-1.5 text-[var(--enterprise-text-muted)] hover:bg-slate-100 hover:text-[var(--enterprise-text)]"
                                    disabled={downloadingKey === `file:${f.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void downloadFile(f);
                                    }}
                                    aria-label={`Download ${f.name}`}
                                  >
                                    {downloadingKey === `file:${f.id}` ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg p-1.5 text-[var(--enterprise-text-muted)] hover:bg-red-50 hover:text-red-600"
                                    disabled={deletingKey === `file:${f.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void deleteFile(f);
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
                ) : (
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,180px))] justify-center gap-4 sm:justify-start">
                    {subfolders.map((fol) => (
                      <li
                        key={fol.id}
                        className="group relative w-full max-w-[180px] justify-self-center sm:justify-self-start"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedFolderId(fol.id)}
                          className="enterprise-card enterprise-card-hover flex w-full max-w-[180px] flex-col overflow-hidden text-left"
                        >
                          <div className="flex h-[160px] w-full items-center justify-center bg-[var(--enterprise-bg)]">
                            <Folder
                              className="h-14 w-14 text-[var(--enterprise-primary)]"
                              strokeWidth={1.25}
                            />
                          </div>
                          <div className="border-t border-[var(--enterprise-border)] p-3 pr-10">
                            <p className="truncate text-[13px] font-semibold text-[var(--enterprise-text)]">
                              {fol.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                              {fol.updatedAt ? formatShortDate(fol.updatedAt) : "—"}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-lg bg-white/95 p-1.5 text-[var(--enterprise-text-muted)] opacity-0 shadow-md ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          disabled={deletingKey === `folder:${fol.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            void deleteFolder(fol);
                          }}
                          aria-label={`Delete folder ${fol.name}`}
                        >
                          {deletingKey === `folder:${fol.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </li>
                    ))}
                    {sortedFiles.map((f) => {
                      const sortedV = sortedFileVersions(f);
                      const sel = getSelectedVersion(f);
                      const rowVer = sortedV.find((x) => x.version === sel) ?? sortedV[0];
                      const size =
                        rowVer != null
                          ? `${formatBytes(rowVer.sizeBytes)} · v${rowVer.version}`
                          : "—";
                      return (
                        <li
                          key={f.id}
                          className="group relative w-full max-w-[180px] justify-self-center sm:justify-self-start"
                        >
                          <div className="enterprise-card enterprise-card-hover flex w-full max-w-[180px] flex-col overflow-hidden">
                            <button
                              type="button"
                              onClick={() => openFile(f)}
                              className="flex w-full flex-col text-left"
                            >
                              <div className="relative h-[160px] w-full overflow-hidden bg-[var(--enterprise-bg)]">
                                <PdfFileThumbnail
                                  fileId={f.id}
                                  fileName={f.name}
                                  mimeType={f.mimeType}
                                  isPdf={isPdfFile(f)}
                                  className="h-full w-full"
                                />
                                {isPdfFile(f) ? (
                                  <div className="pointer-events-none absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 shadow-md ring-1 ring-slate-200">
                                    <PdfFileIcon className="h-5 w-5" />
                                  </div>
                                ) : null}
                              </div>
                              <div className="border-t border-[var(--enterprise-border)] p-3 pr-[4.25rem]">
                                <p className="truncate text-[13px] font-semibold text-[var(--enterprise-text)]">
                                  {f.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                                  {size}
                                </p>
                              </div>
                            </button>
                            {sortedV.length > 1 ? (
                              <div className="border-t border-[var(--enterprise-border)] px-3 py-2">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                                  Open version
                                </label>
                                <select
                                  aria-label={`Version for ${f.name}`}
                                  className="w-full rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1.5 text-[12px] text-[var(--enterprise-text)]"
                                  value={String(sel)}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    setVersionPick((p) => ({ ...p, [f.id]: n }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {sortedV.map((ver) => (
                                    <option key={ver.version} value={ver.version}>
                                      v{ver.version} ({formatBytes(ver.sizeBytes)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                          </div>
                          <div className="absolute right-2 top-2 z-10 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              className="rounded-lg bg-white/95 p-1.5 text-[var(--enterprise-text-muted)] ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-[var(--enterprise-text)]"
                              disabled={downloadingKey === `file:${f.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void downloadFile(f);
                              }}
                              aria-label={`Download ${f.name}`}
                            >
                              {downloadingKey === `file:${f.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-white/95 p-1.5 text-[var(--enterprise-text-muted)] ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-600"
                              disabled={deletingKey === `file:${f.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void deleteFile(f);
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
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="enterprise-card p-10 text-center text-sm text-[var(--enterprise-text-muted)]">
              {projects.length === 0
                ? isAdmin
                  ? "Create your first project to upload files."
                  : "No projects available."
                : "Select a project."}
            </div>
          )}
        </div>
      </div>

      <NewProjectDialog
        open={projectModal}
        saving={saving}
        values={{
          projectName,
          currency,
          measurementSystem,
          startDate,
          endDate,
          projectNumber,
          localBudget,
          projectSize,
          projectType,
          location,
          websiteUrl,
          projectStage,
          progressPercent,
          initialFolderStructure,
          folderTemplateId,
          copyFromProjectId,
        }}
        templates={folderStructureTemplates}
        copySourceProjects={projects}
        onChange={onNewProjectFieldChange}
        onSubmit={onCreateProject}
        onCancel={() => {
          setProjectModal(false);
          resetNewProjectForm();
        }}
        submitLabel="Create"
      />

      <EnterpriseSlideOver
        open={folderModal}
        onClose={() => setFolderModal(false)}
        form={{ onSubmit: onCreateFolder }}
        ariaLabelledBy="projects-new-folder-title"
        header={
          <div>
            <h2
              id="projects-new-folder-title"
              className="text-lg font-semibold text-[var(--enterprise-text)]"
            >
              New folder
            </h2>
            <p className="mt-1 text-sm text-[var(--enterprise-text-muted)]">
              {selectedFolderId ? "Inside the selected folder." : "At project root."}
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
            htmlFor="projects-folder-name"
            className="text-xs font-medium text-[var(--enterprise-text-muted)]"
          >
            Name
          </label>
          <input
            id="projects-folder-name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20"
            placeholder="e.g. Architectural"
            required
            autoFocus
          />
        </div>
      </EnterpriseSlideOver>

      {imageLightbox ? (
        <ProjectFileImageLightbox
          fileId={imageLightbox.fileId}
          fileName={imageLightbox.fileName}
          version={imageLightbox.version}
          onClose={() => setImageLightbox(null)}
        />
      ) : null}
    </div>
  );
}

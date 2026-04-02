import type { QueryClient } from "@tanstack/react-query";
import type { CloudFile, FileVersion, Folder, Project } from "@/types/projects";
import { qk } from "@/lib/queryKeys";

/** Collect folder id and all descendant folder ids (same project tree). */
export function collectFolderSubtreeIds(rootId: string, folders: Folder[]): Set<string> {
  const ids = new Set<string>();
  const walk = (id: string) => {
    ids.add(id);
    for (const f of folders) {
      if (f.parentId === id) walk(f.id);
    }
  };
  walk(rootId);
  return ids;
}

export function mergeUploadedFileIntoProject(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  apiFile: {
    id: string;
    name: string;
    mimeType: string;
    folderId: string | null;
    updatedAt?: string | Date;
  },
  apiVersion: FileVersion,
): void {
  const updatedAt =
    apiFile.updatedAt == null
      ? undefined
      : typeof apiFile.updatedAt === "string"
        ? apiFile.updatedAt
        : new Date(apiFile.updatedAt).toISOString();

  const cloudFile: CloudFile = {
    id: apiFile.id,
    name: apiFile.name,
    mimeType: apiFile.mimeType,
    folderId: apiFile.folderId,
    updatedAt,
    versions: [apiVersion],
  };

  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => {
      if (p.id !== projectId) return p;
      const idx = p.files.findIndex((f) => f.id === cloudFile.id);
      if (idx === -1) {
        return { ...p, files: [...p.files, cloudFile] };
      }
      const existing = p.files[idx];
      const byVer = new Map(existing.versions.map((v) => [v.version, v]));
      for (const v of cloudFile.versions) {
        byVer.set(v.version, v);
      }
      const mergedVersions = [...byVer.values()].sort((a, b) => b.version - a.version);
      const next: CloudFile = {
        ...existing,
        ...cloudFile,
        versions: mergedVersions,
      };
      const files = [...p.files];
      files[idx] = next;
      return { ...p, files };
    });
  });
}

export function removeFileFromProjectCache(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  fileId: string,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) =>
      p.id === projectId ? { ...p, files: p.files.filter((f) => f.id !== fileId) } : p,
    );
  });
}

export function removeFolderSubtreeFromProjectCache(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  folderId: string,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => {
      if (p.id !== projectId) return p;
      const subtree = collectFolderSubtreeIds(folderId, p.folders);
      const nextFolders = p.folders.filter((f) => !subtree.has(f.id));
      const nextFiles = p.files.filter((f) => {
        if (f.folderId == null) return true;
        return !subtree.has(f.folderId);
      });
      return { ...p, folders: nextFolders, files: nextFiles };
    });
  });
}

export function addProjectOptimistic(
  queryClient: QueryClient,
  workspaceId: string,
  project: Project,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => [...(old ?? []), project]);
}

export function replaceProjectInCache(
  queryClient: QueryClient,
  workspaceId: string,
  tempId: string,
  project: Project,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => (p.id === tempId ? project : p));
  });
}

export function addFolderToProjectCache(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  folder: Folder,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => (p.id === projectId ? { ...p, folders: [...p.folders, folder] } : p));
  });
}

export function replaceOptimisticFolder(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  tempId: string,
  folder: Folder,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        folders: p.folders.map((f) => (f.id === tempId ? folder : f)),
      };
    });
  });
}

export function moveFileInProjectCache(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  fileId: string,
  newFolderId: string | null,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        files: p.files.map((f) => (f.id === fileId ? { ...f, folderId: newFolderId } : f)),
      };
    });
  });
}

export function moveFolderInProjectCache(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
  folderId: string,
  newParentId: string | null,
): void {
  queryClient.setQueryData<Project[]>(qk.projects(workspaceId), (old) => {
    if (!old) return old;
    return old.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        folders: p.folders.map((f) => (f.id === folderId ? { ...f, parentId: newParentId } : f)),
      };
    });
  });
}

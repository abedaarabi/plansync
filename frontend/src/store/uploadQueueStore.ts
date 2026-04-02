import { create } from "zustand";
import { apiUrl } from "@/lib/api-url";
import { nanoid } from "nanoid";
import type { QueryClient } from "@tanstack/react-query";
import { mergeUploadedFileIntoProject } from "@/lib/projectsCache";
import { qk } from "@/lib/queryKeys";
import type { FileVersion } from "@/types/projects";

/** Internal drag payload for move (file / folder) within the file explorer. */
export const MOVE_DRAG_MIME = "application/x-plansync-move";

export type MoveDragPayload = { kind: "file" | "folder"; id: string };

export type UploadJob = {
  id: string;
  fileName: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

type UploadQueueState = {
  jobs: UploadJob[];
  enqueue: (args: {
    workspaceId: string;
    projectId: string;
    folderId: string | null;
    files: File[];
    queryClient: QueryClient;
  }) => void;
  removeJob: (id: string) => void;
  clearFinished: () => void;
};

function uploadPdfWithProgress(
  file: File,
  workspaceId: string,
  projectId: string,
  folderId: string | null,
  onProgress: (pct: number) => void,
): Promise<{
  file: {
    id: string;
    name: string;
    mimeType: string;
    folderId: string | null;
    updatedAt?: string;
  };
  fileVersion: FileVersion;
}> {
  const fd = new FormData();
  fd.append("workspaceId", workspaceId);
  fd.append("projectId", projectId);
  if (folderId) fd.append("folderId", folderId);
  fd.append("fileName", file.name);
  fd.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/v1/files/upload"));
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as {
            file: {
              id: string;
              name: string;
              mimeType: string;
              folderId: string | null;
              updatedAt?: string;
            };
            fileVersion: FileVersion;
          };
          resolve(data);
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const j = JSON.parse(xhr.responseText) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}

export const useUploadQueueStore = create<UploadQueueState>((set) => ({
  jobs: [],
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  clearFinished: () =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status !== "done" && j.status !== "error"),
    })),
  enqueue: ({ workspaceId, projectId, folderId, files, queryClient }) => {
    const valid = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    const jobEntries: UploadJob[] = valid.map((file) => ({
      id: nanoid(),
      fileName: file.name,
      status: "queued",
      progress: 0,
    }));
    if (jobEntries.length === 0) return;
    set((s) => ({ jobs: [...s.jobs, ...jobEntries] }));

    jobEntries.forEach((job, i) => {
      const file = valid[i];
      const jobId = job.id;
      void (async () => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId ? { ...j, status: "uploading" as const, progress: 0 } : j,
          ),
        }));
        try {
          const data = await uploadPdfWithProgress(
            file,
            workspaceId,
            projectId,
            folderId,
            (pct) => {
              set((s) => ({
                jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, progress: pct } : j)),
              }));
            },
          );
          mergeUploadedFileIntoProject(
            queryClient,
            workspaceId,
            projectId,
            data.file,
            data.fileVersion,
          );
          await queryClient.invalidateQueries({ queryKey: qk.projects(workspaceId) });
          await queryClient.invalidateQueries({ queryKey: qk.dashboard(workspaceId) });
          await queryClient.invalidateQueries({ queryKey: qk.projectAudit(projectId) });
          await queryClient.invalidateQueries({ queryKey: qk.me() });
          set((s) => ({
            jobs: s.jobs.map((j) =>
              j.id === jobId ? { ...j, status: "done" as const, progress: 100 } : j,
            ),
          }));
        } catch (e) {
          set((s) => ({
            jobs: s.jobs.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: "error" as const,
                    error: e instanceof Error ? e.message : "Upload failed",
                  }
                : j,
            ),
          }));
        }
      })();
    });
  },
}));

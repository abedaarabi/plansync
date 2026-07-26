import { create } from "zustand";
import { nanoid } from "nanoid";
import type { QueryClient } from "@tanstack/react-query";
import { uploadFileViaXHR } from "@/lib/api-client/uploadFileXHR";
import { mergeUploadedFileIntoProject } from "@/lib/projectsCache";
import { qk } from "@/lib/queryKeys";
import type { FileVersion } from "@/types/projects";

/** Internal drag payload for move (file / folder) within the file explorer. */
export const MOVE_DRAG_MIME = "application/x-plansync-move";

export type MoveDragPayload = { kind: "file" | "folder"; id: string };

type UploadJob = {
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
  return uploadFileViaXHR({
    workspaceId,
    projectId,
    folderId,
    fileName: file.name,
    file,
    onProgress,
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
    const valid = Array.from(files);
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
          await queryClient.invalidateQueries({ queryKey: qk.projectAuditRoot(projectId) });
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

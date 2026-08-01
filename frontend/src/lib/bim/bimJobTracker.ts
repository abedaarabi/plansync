"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type BimJobPhase =
  | "uploading"
  | "registering"
  | "extracting_levels"
  | "indexing"
  | "converting_geometry"
  | "ready_to_publish"
  | "published"
  | "failed";

export type BimTrackedJob = {
  fileVersionId: string;
  fileId: string;
  fileName: string;
  projectId: string;
  workspaceId: string;
  phase: BimJobPhase;
  uploadPct: number;
  indexProgress: number | null;
  indexPhase: "summary" | "full" | null;
  conversionStatus: string | null;
  error: string | null;
  startedAt: number;
  updatedAt: number;
};

type BimJobStore = {
  jobs: Record<string, BimTrackedJob>;
  upsertJob: (job: BimTrackedJob) => void;
  patchJob: (fileVersionId: string, patch: Partial<BimTrackedJob>) => void;
  removeJob: (fileVersionId: string) => void;
  activeJobs: () => BimTrackedJob[];
};

export const useBimJobTracker = create<BimJobStore>()(
  persist(
    (set, get) => ({
      jobs: {},
      upsertJob: (job) =>
        set((s) => ({
          jobs: { ...s.jobs, [job.fileVersionId]: job },
        })),
      patchJob: (fileVersionId, patch) =>
        set((s) => {
          const cur = s.jobs[fileVersionId];
          if (!cur) return s;
          return {
            jobs: {
              ...s.jobs,
              [fileVersionId]: { ...cur, ...patch, updatedAt: Date.now() },
            },
          };
        }),
      removeJob: (fileVersionId) =>
        set((s) => {
          const next = { ...s.jobs };
          delete next[fileVersionId];
          return { jobs: next };
        }),
      activeJobs: () => selectActiveJobs(get().jobs),
    }),
    {
      name: "plansync-bim-jobs",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ jobs: s.jobs }),
    },
  ),
);

const PHASE_ORDER: BimJobPhase[] = [
  "uploading",
  "registering",
  "extracting_levels",
  "indexing",
  "converting_geometry",
  "ready_to_publish",
  "published",
  "failed",
];

const TERMINAL_PHASES = new Set<BimJobPhase>(["published", "ready_to_publish", "failed"]);

export function selectActiveJobs(jobs: Record<string, BimTrackedJob>): BimTrackedJob[] {
  return Object.values(jobs).filter((j) => !TERMINAL_PHASES.has(j.phase));
}

export function jobPhaseFromStatus(status: {
  conversionStatus: string;
  fragmentsReady: boolean;
  quantityIndexSummaryReady: boolean;
  quantityIndexReady: boolean;
  bimPublishedAt?: string | null;
}): BimJobPhase {
  if (status.conversionStatus === "failed") return "failed";
  if (status.bimPublishedAt && status.fragmentsReady) return "published";
  if (status.bimPublishedAt && !status.fragmentsReady) return "converting_geometry";

  // Geometry or full index ready → processing is done (publish is optional).
  // Previously fragmentsReady + !quantityIndexReady stayed on converting_geometry forever.
  if (status.fragmentsReady || status.quantityIndexReady || status.conversionStatus === "ready") {
    return "ready_to_publish";
  }

  if (
    status.conversionStatus === "running" ||
    status.conversionStatus === "summary_ready" ||
    status.quantityIndexSummaryReady
  ) {
    return "indexing";
  }

  if (status.conversionStatus === "pending" || status.conversionStatus === "queued") {
    return "registering";
  }

  return "indexing";
}

/** Prefer live status over a stale tracked phase so UI cannot spin forever. */
export function mergeJobPhase(
  statusPhase: BimJobPhase,
  trackedPhase?: BimJobPhase | null,
): BimJobPhase {
  if (!trackedPhase) return statusPhase;
  if (TERMINAL_PHASES.has(statusPhase)) return statusPhase;
  if (TERMINAL_PHASES.has(trackedPhase) && statusPhase !== "failed") {
    // Tracked thinks we're done but status disagrees — trust status.
    return statusPhase;
  }
  const statusIdx = PHASE_ORDER.indexOf(statusPhase);
  const trackedIdx = PHASE_ORDER.indexOf(trackedPhase);
  if (statusIdx < 0) return trackedPhase;
  if (trackedIdx < 0) return statusPhase;
  return statusIdx >= trackedIdx ? statusPhase : trackedPhase;
}

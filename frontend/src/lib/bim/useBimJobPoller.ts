"use client";

import { useEffect, useMemo } from "react";
import { fetchBimStatus } from "@/lib/api-client/bim-viewer";
import {
  jobPhaseFromStatus,
  selectActiveJobs,
  useBimJobTracker,
  type BimTrackedJob,
} from "@/lib/bim/bimJobTracker";

const POLL_MS = 3000;
/** Drop zombie jobs that never reach a terminal phase (e.g. deleted file versions). */
const STALE_JOB_MS = 2 * 60 * 60 * 1000;

/** Poll BIM conversion status for all active tracked jobs. */
export function useBimJobPoller(): BimTrackedJob[] {
  const jobs = useBimJobTracker((s) => s.jobs);
  const patchJob = useBimJobTracker((s) => s.patchJob);
  const removeJob = useBimJobTracker((s) => s.removeJob);

  const active = useMemo(() => selectActiveJobs(jobs), [jobs]);

  /** Stable key so progress patches don't restart the interval every poll. */
  const activeJobIds = useMemo(
    () =>
      active
        .map((j) => j.fileVersionId)
        .sort()
        .join(","),
    [active],
  );

  useEffect(() => {
    if (!activeJobIds) return;

    let cancelled = false;

    const tick = async () => {
      const now = Date.now();
      const current = selectActiveJobs(useBimJobTracker.getState().jobs);
      for (const job of current) {
        if (now - job.updatedAt > STALE_JOB_MS) {
          removeJob(job.fileVersionId);
          continue;
        }
        try {
          const status = await fetchBimStatus(job.fileVersionId);
          if (cancelled) return;
          const phase = jobPhaseFromStatus(status);
          patchJob(job.fileVersionId, {
            phase,
            indexProgress: status.indexProgress,
            indexPhase: status.indexPhase,
            conversionStatus: status.conversionStatus,
            error: status.conversionStatus === "failed" ? "Conversion failed" : null,
          });
          if (phase === "ready_to_publish" || phase === "published") {
            removeJob(job.fileVersionId);
          }
        } catch {
          // 404 / unauthorized: version is gone — stop polling forever.
          removeJob(job.fileVersionId);
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeJobIds, patchJob, removeJob]);

  return active;
}

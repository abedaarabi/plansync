import {
  jobPhaseFromStatus,
  mergeJobPhase,
  selectActiveJobs,
  type BimJobPhase,
  type BimTrackedJob,
} from "@/lib/bim/bimJobTracker";
import type { BimConversionStatus } from "@/lib/bim/types";

export type IfcModelUiStatus =
  | { kind: "processing"; label: string; spinning: true; phase: BimJobPhase }
  | { kind: "ready_to_publish"; label: "Ready to publish"; phase: "ready_to_publish" }
  | { kind: "uploaded"; label: "Uploaded"; phase: BimJobPhase }
  | { kind: "published_processing"; label: "Published · processing"; spinning: true }
  | { kind: "ready"; label: string; phase: "published" }
  | { kind: "failed"; label: "Processing failed"; phase: "failed" };

/** True when the BIM viewer can load 3D geometry for this version. */
export function canOpenBimViewer(
  status: Pick<BimConversionStatus, "bimPublishedAt" | "fragmentsReady" | "conversionStatus">,
): boolean {
  return status.fragmentsReady && status.conversionStatus !== "failed";
}

/** Published + geometry ready (levels/maps workflow complete). */
export function isBimPublishedReady(
  status: Pick<BimConversionStatus, "bimPublishedAt" | "fragmentsReady" | "conversionStatus">,
): boolean {
  return Boolean(status.bimPublishedAt) && canOpenBimViewer(status);
}

/**
 * Whether the files list should keep polling `/bim/status` for this version.
 * Idle uploaded / unpublished IFCs must NOT be polled — only active work.
 */
// fallow-ignore-next-line complexity
export function needsBimStatusPolling(
  verRow: { bimPublishedAt?: string | null },
  status: BimConversionStatus | null | undefined,
  trackedJob?: BimTrackedJob | null,
): boolean {
  if (status) {
    if (canOpenBimViewer(status)) return false;
    if (status.conversionStatus === "failed") return false;
    if (status.conversionStatus === "ready" || status.quantityIndexReady) return false;
  }

  if (trackedJob) {
    const active = selectActiveJobs({ [trackedJob.fileVersionId]: trackedJob });
    if (active.length > 0) return true;
  }

  if (!status) {
    // Published but status not hydrated yet — fetch once via poll/hydrate.
    return Boolean(verRow.bimPublishedAt);
  }

  // Published, geometry still building.
  if (status.bimPublishedAt && !status.fragmentsReady) return true;

  // Server reports an active conversion pipeline.
  if (
    status.conversionStatus === "running" ||
    status.conversionStatus === "summary_ready" ||
    status.conversionStatus === "queued"
  ) {
    return true;
  }

  // Idle uploaded / ready-to-publish — badge is static; no continuous poll.
  return false;
}

export function ifcStatusSpinning(status: IfcModelUiStatus | null | undefined): boolean {
  return status != null && "spinning" in status && status.spinning;
}

export function resolveIfcUiPhase(
  status: BimConversionStatus,
  trackedJob?: BimTrackedJob | null,
): BimJobPhase {
  const fromStatus = jobPhaseFromStatus(status);
  return mergeJobPhase(fromStatus, trackedJob?.phase ?? null);
}

// fallow-ignore-next-line complexity
export function ifcModelUiStatus(
  status: BimConversionStatus | null | undefined,
  trackedJob?: BimTrackedJob | null,
  publishSummary?: { levelCount: number; mapCount: number } | null,
): IfcModelUiStatus | null {
  if (!status) {
    if (trackedJob && trackedJob.phase !== "published" && trackedJob.phase !== "ready_to_publish") {
      return {
        kind: "processing",
        label: processingLabel(trackedJob.phase),
        spinning: true,
        phase: trackedJob.phase,
      };
    }
    return null;
  }

  if (status.conversionStatus === "failed") {
    return { kind: "failed", label: "Processing failed", phase: "failed" };
  }

  if (status.bimPublishedAt && status.fragmentsReady) {
    const levels = publishSummary?.levelCount ?? status.levelCount;
    const maps = publishSummary?.mapCount ?? status.mappedSheetCount;
    return {
      kind: "ready",
      label: `${levels} level${levels === 1 ? "" : "s"} · ${maps} sheet${maps === 1 ? "" : "s"}`,
      phase: "published",
    };
  }

  if (status.bimPublishedAt && !status.fragmentsReady) {
    return { kind: "published_processing", label: "Published · processing", spinning: true };
  }

  const phase = resolveIfcUiPhase(status, trackedJob);
  if (phase === "ready_to_publish") {
    return { kind: "ready_to_publish", label: "Ready to publish", phase: "ready_to_publish" };
  }

  if (
    phase === "uploading" ||
    phase === "registering" ||
    phase === "extracting_levels" ||
    phase === "indexing" ||
    phase === "converting_geometry"
  ) {
    return {
      kind: "processing",
      label: processingLabel(phase),
      spinning: true,
      phase,
    };
  }

  if (status.quantityIndexReady || status.fragmentsReady) {
    return { kind: "uploaded", label: "Uploaded", phase: "ready_to_publish" };
  }

  return { kind: "uploaded", label: "Uploaded", phase: "extracting_levels" };
}

function processingLabel(phase: BimJobPhase): string {
  switch (phase) {
    case "uploading":
      return "Uploading…";
    case "registering":
      return "Saving…";
    case "extracting_levels":
      return "Extracting levels…";
    case "indexing":
      return "Cataloging…";
    case "converting_geometry":
      return "Building 3D…";
    default:
      return "Processing…";
  }
}

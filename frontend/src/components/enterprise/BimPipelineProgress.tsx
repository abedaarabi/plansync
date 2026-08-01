"use client";

import {
  Box,
  CheckCircle2,
  CloudUpload,
  Database,
  FileCheck,
  GitCompare,
  Layers3,
  Rocket,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BimJobPhase } from "@/lib/bim/bimJobTracker";
import {
  PipelineTimeline,
  type PipelineTimelineStep,
  type PipelineTimelineStepState,
} from "./PipelineTimeline";

type StageId = BimJobPhase | "diffing" | "done";

type StageDef = {
  id: StageId;
  label: string;
  icon: typeof CloudUpload;
};

const PUBLISH_STAGES: StageDef[] = [
  { id: "uploading", label: "Uploading file", icon: CloudUpload },
  { id: "registering", label: "Reading IFC", icon: FileCheck },
  { id: "extracting_levels", label: "Extracting levels", icon: Layers3 },
  { id: "indexing", label: "Detecting systems and disciplines", icon: Database },
  { id: "converting_geometry", label: "Optimizing geometry", icon: Box },
  { id: "diffing", label: "Matching existing models", icon: GitCompare },
  { id: "ready_to_publish", label: "Ready for review", icon: Rocket },
  { id: "published", label: "Model published", icon: CheckCircle2 },
];

/** Upload-only: convert in background — no levels / publish framing. */
const UPLOAD_STAGES: StageDef[] = [
  { id: "uploading", label: "Uploading file", icon: CloudUpload },
  { id: "registering", label: "Reading IFC", icon: FileCheck },
  { id: "indexing", label: "Building spatial index", icon: Database },
  { id: "converting_geometry", label: "Optimizing geometry", icon: Box },
  { id: "done", label: "Ready in project", icon: CheckCircle2 },
];

const PUBLISH_ORDER: StageId[] = PUBLISH_STAGES.map((s) => s.id);
const UPLOAD_ORDER: StageId[] = UPLOAD_STAGES.map((s) => s.id);

function normalizePhaseForVariant(phase: BimJobPhase, variant: "publish" | "upload"): StageId {
  if (variant === "upload") {
    if (phase === "extracting_levels") return "indexing";
    if (phase === "ready_to_publish" || phase === "published") return "done";
    return phase;
  }
  return phase;
}

function stageIndex(order: StageId[], id: StageId): number {
  const idx = order.indexOf(id);
  return idx >= 0 ? idx : order.length - 1;
}

function stageStatusText(
  id: StageId,
  done: boolean,
  active: boolean,
  uploadPct?: number,
  indexProgress?: number | null,
): string {
  if (done) return "Completed";
  if (!active) return "Pending";
  if (id === "uploading" && uploadPct != null && uploadPct > 0) {
    return `${Math.round(uploadPct)}% complete`;
  }
  if (id === "indexing" && indexProgress != null) {
    return `${Math.round(Math.max(0, indexProgress))}% indexed`;
  }
  return "In progress";
}

// fallow-ignore-next-line complexity
export function BimPipelineProgress(props: {
  phase: BimJobPhase;
  uploadPct?: number;
  indexProgress?: number | null;
  indexPhase?: "summary" | "full" | null;
  error?: string | null;
  compact?: boolean;
  /** When true, show the publish stage (for published models still finishing geometry). */
  showPublishedStage?: boolean;
  hideBackgroundHint?: boolean;
  /**
   * `upload` — process IFC in background (no extract-levels / ready-to-publish).
   * `publish` — full publish pipeline (default).
   */
  variant?: "publish" | "upload";
  fileName?: string | null;
  fileMeta?: string | null;
  side?: ReactNode;
  title?: string;
}) {
  const variant = props.variant ?? "publish";
  const stages = variant === "upload" ? UPLOAD_STAGES : PUBLISH_STAGES;
  const order = variant === "upload" ? UPLOAD_ORDER : PUBLISH_ORDER;
  const displayPhase = normalizePhaseForVariant(props.phase, variant);
  const activeIdx = stageIndex(order, displayPhase);
  const failed = props.phase === "failed";
  const showPublished =
    variant === "publish" && (props.showPublishedStage ?? props.phase === "published");

  const stageLabel = (id: StageId, label: string): string => {
    if (id !== "indexing") return label;
    if (props.indexPhase === "full") return "Building spatial index";
    return label;
  };

  const visibleStages = stages.filter((s) => {
    if (variant === "upload") return true;
    if (s.id === "diffing") return activeIdx >= stageIndex(order, "indexing");
    if (s.id === "published") return showPublished;
    if (s.id === "ready_to_publish" && showPublished) return false;
    return true;
  });

  // fallow-ignore-next-line complexity
  const timelineSteps: PipelineTimelineStep[] = visibleStages.flatMap((stage) => {
    const idx = stageIndex(order, stage.id);
    const done =
      !failed &&
      (activeIdx > idx ||
        (stage.id === "done" && displayPhase === "done") ||
        (stage.id === "published" && props.phase === "published") ||
        (stage.id === "ready_to_publish" && props.phase === "published" && !showPublished));
    const active =
      !failed &&
      (displayPhase === stage.id ||
        (stage.id === "published" && showPublished && props.phase === "converting_geometry") ||
        (stage.id === "converting_geometry" &&
          showPublished &&
          props.phase === "converting_geometry"));
    const state: PipelineTimelineStepState =
      failed && active ? "failed" : done ? "done" : active ? "active" : "pending";

    if (props.compact && !done && !active) return [];

    const progressPct =
      stage.id === "uploading" && active && props.uploadPct != null
        ? props.uploadPct
        : stage.id === "indexing" && active && props.indexProgress != null
          ? props.indexProgress
          : null;

    return [
      {
        id: stage.id,
        label: stageLabel(stage.id, stage.label),
        statusText: stageStatusText(stage.id, done, active, props.uploadPct, props.indexProgress),
        state,
        progressPct,
      },
    ];
  });

  const title = props.title ?? "Uploading and preparing your model";
  const footer =
    failed || props.hideBackgroundHint
      ? null
      : variant === "upload"
        ? "You can close this window — conversion continues in the background. Open the model when geometry is ready."
        : "You can close this dialog. We'll notify you when your model is ready.";

  return (
    <div
      className={`enterprise-animate-in rounded-2xl border ${failed ? "border-red-200 bg-red-50/35" : "border-[var(--enterprise-border)] bg-white"} p-4 shadow-[var(--enterprise-shadow-xs)] sm:p-5`}
      role="status"
      aria-live="polite"
    >
      <div className="mb-5">
        <h3 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
          {title}
        </h3>
        {props.fileName ? (
          <p className="mt-0.5 truncate text-sm text-[var(--enterprise-text-muted)]">
            {props.fileName}
            {props.fileMeta ? ` · ${props.fileMeta}` : ""}
          </p>
        ) : null}
      </div>

      <PipelineTimeline
        steps={timelineSteps}
        side={props.side}
        footer={footer}
        failedMessage={failed ? (props.error ?? "Processing failed.") : null}
      />
    </div>
  );
}

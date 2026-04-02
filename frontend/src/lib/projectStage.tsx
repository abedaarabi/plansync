"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  Package,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

/** Mirrors `ProjectStage` in Prisma — lifecycle for scheduling & reporting. */
export type ProjectStageValue =
  | "NOT_STARTED"
  | "PLANNING"
  | "PRECONSTRUCTION"
  | "CONSTRUCTION"
  | "CLOSEOUT"
  | "COMPLETED"
  | "ON_HOLD";

export const PROJECT_STAGES: { value: ProjectStageValue; label: string; short: string }[] = [
  { value: "NOT_STARTED", label: "Not started", short: "Not started" },
  { value: "PLANNING", label: "Planning & design", short: "Planning" },
  { value: "PRECONSTRUCTION", label: "Pre-construction", short: "Pre-con" },
  { value: "CONSTRUCTION", label: "Construction", short: "Build" },
  { value: "CLOSEOUT", label: "Closeout", short: "Closeout" },
  { value: "COMPLETED", label: "Completed", short: "Done" },
  { value: "ON_HOLD", label: "On hold", short: "Hold" },
];

export function projectStageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  return PROJECT_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

const iconProps = {
  className: "h-3 w-3 shrink-0 opacity-90",
  strokeWidth: 2 as const,
  "aria-hidden": true as const,
};

/** Renders the lifecycle icon (stable module-level element tree for React Compiler). */
export function ProjectStageIconGlyph({ stage }: { stage: string | null | undefined }) {
  switch (stage) {
    case "NOT_STARTED":
      return <PlayCircle {...iconProps} />;
    case "PLANNING":
      return <ClipboardList {...iconProps} />;
    case "PRECONSTRUCTION":
      return <Package {...iconProps} />;
    case "CONSTRUCTION":
      return <HardHat {...iconProps} />;
    case "CLOSEOUT":
      return <ClipboardCheck {...iconProps} />;
    case "COMPLETED":
      return <CheckCircle2 {...iconProps} />;
    case "ON_HOLD":
      return <PauseCircle {...iconProps} />;
    default:
      return <PlayCircle {...iconProps} />;
  }
}

/** Tailwind classes for compact badges (light bg + text). */
export function projectStageBadgeClass(stage: string | null | undefined): string {
  switch (stage) {
    case "NOT_STARTED":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "PLANNING":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "PRECONSTRUCTION":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    case "CONSTRUCTION":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "CLOSEOUT":
      return "bg-violet-50 text-violet-800 ring-violet-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "ON_HOLD":
      return "bg-orange-50 text-orange-900 ring-orange-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

"use client";

import {
  ProjectStageIconGlyph,
  projectStageBadgeClass,
  projectStageLabel,
} from "@/lib/projectStage";

type Props = {
  stage: string | null | undefined;
  className?: string;
};

export function ProjectStageBadge({ stage, className = "" }: Props) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${projectStageBadgeClass(stage)} ${className}`}
    >
      <ProjectStageIconGlyph stage={stage} />
      <span className="truncate">{projectStageLabel(stage)}</span>
    </span>
  );
}

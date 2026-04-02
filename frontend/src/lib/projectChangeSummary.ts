import type { Project } from "@/types/projects";
import { projectStageLabel, type ProjectStageValue } from "@/lib/projectStage";

export type ProjectChangeRow = { label: string; before: string; after: string };

function disp(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t || "—";
}

export function buildProjectChangeRows(
  project: Project,
  fields: {
    nameEd: string;
    projectNumberEd: string;
    localBudgetEd: string;
    projectSizeEd: string;
    projectTypeEd: string;
    locationEd: string;
    websiteEd: string;
    stageEd: ProjectStageValue;
    progressEd: number;
  },
): ProjectChangeRow[] {
  const rows: ProjectChangeRow[] = [];
  const {
    nameEd,
    projectNumberEd,
    localBudgetEd,
    projectSizeEd,
    projectTypeEd,
    locationEd,
    websiteEd,
    stageEd,
    progressEd,
  } = fields;

  const budgetCur =
    project.localBudget != null && project.localBudget !== ""
      ? String(project.localBudget).replace(/,/g, "")
      : "";
  const budgetEdNorm = localBudgetEd.trim().replace(/,/g, "");

  if (nameEd.trim() !== project.name) {
    rows.push({
      label: "Project name",
      before: disp(project.name),
      after: disp(nameEd),
    });
  }
  if (projectNumberEd.trim() !== (project.projectNumber ?? "").trim()) {
    rows.push({
      label: "Project number",
      before: disp(project.projectNumber),
      after: disp(projectNumberEd),
    });
  }
  if (budgetEdNorm !== budgetCur) {
    rows.push({
      label: "Local budget",
      before: budgetCur ? disp(budgetCur) : "—",
      after: budgetEdNorm ? disp(budgetEdNorm) : "—",
    });
  }
  if (projectSizeEd.trim() !== (project.projectSize ?? "").trim()) {
    rows.push({
      label: "Size",
      before: disp(project.projectSize),
      after: disp(projectSizeEd),
    });
  }
  if (projectTypeEd.trim() !== (project.projectType ?? "").trim()) {
    rows.push({
      label: "Type",
      before: disp(project.projectType),
      after: disp(projectTypeEd),
    });
  }
  if (locationEd.trim() !== (project.location ?? "").trim()) {
    rows.push({
      label: "Location",
      before: disp(project.location),
      after: disp(locationEd),
    });
  }
  if (websiteEd.trim() !== (project.websiteUrl ?? "").trim()) {
    rows.push({
      label: "Website",
      before: disp(project.websiteUrl),
      after: disp(websiteEd),
    });
  }
  const stageCur = ((project.stage as ProjectStageValue) ?? "NOT_STARTED") as ProjectStageValue;
  if (stageEd !== stageCur) {
    rows.push({
      label: "Stage",
      before: projectStageLabel(stageCur),
      after: projectStageLabel(stageEd),
    });
  }
  const progressCur = typeof project.progressPercent === "number" ? project.progressPercent : 0;
  if (progressEd !== progressCur) {
    rows.push({
      label: "Overall progress",
      before: `${progressCur}%`,
      after: `${progressEd}%`,
    });
  }

  return rows;
}

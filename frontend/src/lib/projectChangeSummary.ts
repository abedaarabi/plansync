import type { Project } from "@/types/projects";
import { projectStageLabel, type ProjectStageValue } from "@/lib/projectStage";
import { formatProjectCurrencyLabel } from "@/lib/projectCurrency";
import {
  PROJECT_MEASUREMENT_SYSTEMS,
  type ProjectMeasurementSystem,
} from "@/lib/projectMeasurement";

export type ProjectChangeRow = { label: string; before: string; after: string };

function disp(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t || "—";
}

function measurementSystemLabel(v: ProjectMeasurementSystem): string {
  return PROJECT_MEASUREMENT_SYSTEMS.find((x) => x.value === v)?.title ?? v;
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
    currencyEd: string;
    measurementSystemEd: ProjectMeasurementSystem;
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
    currencyEd,
    measurementSystemEd,
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
  const currencyCur = (project.currency as string) || "USD";
  if (currencyEd !== currencyCur) {
    rows.push({
      label: "Currency",
      before: formatProjectCurrencyLabel(currencyCur),
      after: formatProjectCurrencyLabel(currencyEd),
    });
  }
  const msCur = ((project.measurementSystem as ProjectMeasurementSystem) ||
    "METRIC") as ProjectMeasurementSystem;
  if (measurementSystemEd !== msCur) {
    rows.push({
      label: "Measurement system",
      before: measurementSystemLabel(msCur),
      after: measurementSystemLabel(measurementSystemEd),
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

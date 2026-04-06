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

function pinLabel(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function pinsEqual(
  aLat: number | null,
  aLng: number | null,
  bLat: number | null,
  bLng: number | null,
): boolean {
  if (aLat == null && aLng == null && bLat == null && bLng == null) return true;
  if (aLat == null || aLng == null || bLat == null || bLng == null) return false;
  return Math.abs(aLat - bLat) < 1e-6 && Math.abs(aLng - bLng) < 1e-6;
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
    latitudeEd: number | null;
    longitudeEd: number | null;
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
    latitudeEd,
    longitudeEd,
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
  const curLat = project.latitude ?? null;
  const curLng = project.longitude ?? null;
  if (!pinsEqual(curLat, curLng, latitudeEd, longitudeEd)) {
    rows.push({
      label: "Map pin",
      before: pinLabel(curLat, curLng),
      after: pinLabel(latitudeEd, longitudeEd),
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

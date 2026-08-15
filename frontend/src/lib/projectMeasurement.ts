import { formatAreaMm2, formatLengthMm, type MeasureUnit } from "@/lib/coords";
import type { TakeoffMeasurementType, TakeoffUnit } from "@/lib/takeoffTypes";

/** Mirrors Prisma `ProjectMeasurementSystem`. */
export type ProjectMeasurementSystem = "METRIC" | "IMPERIAL";

export type ProjectDisplayQuantityKind = "length" | "area" | "volume";

export function normalizeProjectMeasurementSystem(raw: unknown): ProjectMeasurementSystem {
  return raw === "IMPERIAL" ? "IMPERIAL" : "METRIC";
}

export function defaultMeasureUnitForProject(system: ProjectMeasurementSystem): MeasureUnit {
  return system === "IMPERIAL" ? "ft" : "mm";
}

/** Default takeoff quantity unit for new lines, aligned with project metric vs imperial. */
export function defaultTakeoffUnitForKind(
  kind: TakeoffMeasurementType,
  system: ProjectMeasurementSystem,
): TakeoffUnit {
  if (kind === "count") return "ea";
  if (system === "IMPERIAL") {
    if (kind === "area") return "ft²";
    if (kind === "linear") return "ft";
  }
  if (kind === "area") return "m²";
  if (kind === "linear") return "m";
  return "m²";
}

/** Display unit labels for IFC/QTO quantities (SI source: m / m² / m³). */
export function projectDisplayUnits(system: ProjectMeasurementSystem): {
  length: string;
  area: string;
  volume: string;
} {
  if (system === "IMPERIAL") {
    return { length: "ft", area: "ft²", volume: "ft³" };
  }
  return { length: "m", area: "m²", volume: "m³" };
}

/** Convert SI (m / m² / m³) to project display units. */
export function siQuantityToDisplay(
  value: number,
  kind: ProjectDisplayQuantityKind,
  system: ProjectMeasurementSystem,
): number {
  if (!Number.isFinite(value) || system === "METRIC") return value;
  if (kind === "length") return value * 3.280839895;
  if (kind === "area") return value * 10.763910417;
  return value * 35.314666721;
}

export function formatSiQuantityForProject(
  value: number,
  kind: ProjectDisplayQuantityKind,
  system: ProjectMeasurementSystem,
  digits = 2,
): string {
  if (!Number.isFinite(value)) return "—";
  const units = projectDisplayUnits(system);
  const n = siQuantityToDisplay(value, kind, system);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} ${units[kind]}`;
}

/** Format raw takeoff geometry (mm / mm²) using the project measurement system. */
export function formatRawGeometryForProject(
  kind: TakeoffMeasurementType,
  raw: number,
  system: ProjectMeasurementSystem,
): string {
  if (kind === "count") return `${Math.max(0, Math.round(raw))} marks`;
  const unit = defaultMeasureUnitForProject(system);
  if (kind === "linear") return formatLengthMm(raw, unit);
  return formatAreaMm2(raw, unit);
}

export const PROJECT_MEASUREMENT_SYSTEMS: {
  value: ProjectMeasurementSystem;
  title: string;
  description: string;
}[] = [
  {
    value: "METRIC",
    title: "Metric",
    description: "Millimetres, metres, m² — typical for EU, UK, APAC",
  },
  {
    value: "IMPERIAL",
    title: "Imperial / US",
    description: "Feet, inches, ft² — typical for US construction",
  },
];

import type { MeasureUnit } from "@/lib/coords";
import type { TakeoffMeasurementType, TakeoffUnit } from "@/lib/takeoffTypes";

/** Mirrors Prisma `ProjectMeasurementSystem`. */
export type ProjectMeasurementSystem = "METRIC" | "IMPERIAL";

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

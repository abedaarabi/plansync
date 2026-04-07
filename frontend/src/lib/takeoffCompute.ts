import { pdfDistanceUnits } from "@/lib/coords";
import { polygonAreaMm2, polylineLengthMm } from "@/lib/measureCompute";
import type {
  TakeoffItem,
  TakeoffMeasurementType,
  TakeoffUnit,
  TakeoffZone,
} from "@/lib/takeoffTypes";

/** Recompute raw + computed quantities after geometry change (same measurement type). */
/** Count redraw: append new marks to the zone, or use only the new batch. */
export function combineCountRedrawPoints(
  existing: { x: number; y: number }[],
  draft: { x: number; y: number }[],
  mode: "merge" | "replace",
): { x: number; y: number }[] {
  if (mode === "replace") return draft.map((p) => ({ ...p }));
  return [...existing.map((p) => ({ ...p })), ...draft.map((p) => ({ ...p }))];
}

export function patchZoneQuantitiesFromPoints(
  zone: Pick<TakeoffZone, "measurementType">,
  item: Pick<
    TakeoffItem,
    "measurementType" | "unit" | "linearFactor" | "wastePercent" | "heightMm"
  >,
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number,
): { points: { x: number; y: number }[]; rawQuantity: number; computedQuantity: number } {
  const pts = points.map((p) => ({ ...p }));
  const rawQuantity = computeRawQuantity(zone.measurementType, pts, pageW, pageH, mmPerPdfUnit);
  const computedQuantity = applyItemToRawQuantity(item, rawQuantity);
  return { points: pts, rawQuantity, computedQuantity };
}

export function computeRawQuantity(
  kind: TakeoffMeasurementType,
  points: { x: number; y: number }[],
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number,
): number {
  if (kind === "count") return Math.max(0, points.length);
  if (kind === "linear") {
    if (points.length < 2) return 0;
    return polylineLengthMm(points, pageW, pageH, mmPerPdfUnit);
  }
  if (kind === "area") {
    if (points.length < 3) return 0;
    return polygonAreaMm2(points, pageW, pageH, mmPerPdfUnit);
  }
  return 0;
}

/** `rawGeometry`: length in mm, area in mm², or count. */
export function rawToDisplayUnit(
  kind: TakeoffMeasurementType,
  rawGeometry: number,
  unit: TakeoffUnit,
): number {
  if (kind === "count") return rawGeometry;

  if (kind === "area") {
    const mm2 = rawGeometry;
    switch (unit) {
      case "mm²":
        return mm2;
      case "m²":
        return mm2 / 1_000_000;
      case "ft²":
        return mm2 / (304.8 * 304.8);
      default:
        return mm2 / 1_000_000;
    }
  }

  const lengthMm = rawGeometry;
  switch (unit) {
    case "mm":
      return lengthMm;
    case "m":
      return lengthMm / 1000;
    case "ft":
      return lengthMm / 304.8;
    case "kg":
      return lengthMm;
    default:
      return lengthMm / 1000;
  }
}

export function applyItemToRawQuantity(
  item: Pick<
    TakeoffItem,
    "measurementType" | "unit" | "linearFactor" | "wastePercent" | "heightMm"
  >,
  rawGeometry: number,
): number {
  let base: number;

  /** Plan length × vertical height → wall / strip area (e.g. finish priced per m²). */
  if (
    item.measurementType === "linear" &&
    item.heightMm != null &&
    item.heightMm > 0 &&
    (item.unit === "m²" || item.unit === "mm²" || item.unit === "ft²")
  ) {
    const lengthMm = rawGeometry;
    if (item.unit === "m²") {
      base = (lengthMm / 1000) * (item.heightMm / 1000);
    } else if (item.unit === "mm²") {
      base = lengthMm * item.heightMm;
    } else {
      base = (lengthMm / 304.8) * (item.heightMm / 304.8);
    }
    const waste = item.wastePercent ?? 0;
    if (waste > 0) base *= 1 + waste / 100;
    return base;
  }

  if (
    item.measurementType === "area" &&
    item.heightMm != null &&
    item.heightMm > 0 &&
    (item.unit === "m³" || item.unit === "mm³" || item.unit === "ft³")
  ) {
    const rawMm2 = rawGeometry;
    if (item.unit === "m³") {
      const areaM2 = rawMm2 / 1_000_000;
      base = areaM2 * (item.heightMm / 1000);
    } else if (item.unit === "mm³") {
      base = rawMm2 * item.heightMm;
    } else {
      const mm2PerFt2 = 304.8 * 304.8;
      const areaFt2 = rawMm2 / mm2PerFt2;
      base = areaFt2 * (item.heightMm / 304.8);
    }
    const waste = item.wastePercent ?? 0;
    if (waste > 0) base *= 1 + waste / 100;
    return base;
  }

  if (item.measurementType === "linear" && item.unit === "kg" && item.linearFactor != null) {
    const lengthMm = rawGeometry;
    base = (lengthMm / 1000) * item.linearFactor;
  } else {
    base = rawToDisplayUnit(item.measurementType, rawGeometry, item.unit);
  }

  const waste = item.wastePercent ?? 0;
  if (item.measurementType !== "count" && waste > 0) {
    base *= 1 + waste / 100;
  }

  return base;
}

export function sumZonesForItem(zones: TakeoffZone[], itemId: string): number {
  return zones.filter((z) => z.itemId === itemId).reduce((s, z) => s + z.computedQuantity, 0);
}

/** Sum geometry-derived raw quantities (mm², mm, or mark count) for all zones of an item. */
export function sumRawQuantityForItem(zones: TakeoffZone[], itemId: string): number {
  return zones.filter((z) => z.itemId === itemId).reduce((s, z) => s + z.rawQuantity, 0);
}

/** Human-readable raw geometry for tooltips and sidebar (always base units). */
export function formatRawQuantityLabel(kind: TakeoffMeasurementType, raw: number): string {
  if (kind === "count") return `${Math.max(0, Math.round(raw))} marks`;
  if (kind === "linear") return `${raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm`;
  return `${raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} mm²`;
}

/** Axis-aligned rectangle from two opposite corners in normalized [0,1]² (4 points, closed). */
export function rectPolygonFromTwoCornersNorm(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number }[] {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

export function segmentLengthMm(
  a: { x: number; y: number },
  b: { x: number; y: number },
  pageW: number,
  pageH: number,
  mmPerPdfUnit: number,
): number {
  const pdfD = pdfDistanceUnits(a, b, pageW, pageH);
  return pdfD * mmPerPdfUnit;
}

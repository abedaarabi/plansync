/**
 * ACC-style quantity takeoff — items, zones, governance (client + optional cloud sync).
 */

export type TakeoffMeasurementType = "area" | "linear" | "count";

/** Display / export unit label (user-facing). */
export type TakeoffUnit = "m²" | "m" | "m³" | "mm²" | "mm" | "ft²" | "ft" | "ea" | "kg";

export type TakeoffPackageStatus = "draft" | "checked" | "approved";

export type TakeoffItem = {
  id: string;
  name: string;
  category?: string;
  unit: TakeoffUnit;
  measurementType: TakeoffMeasurementType;
  /** Linked workspace material catalog row (drives pricing when set). */
  materialId?: string | null;
  /** Linear × factor → kg, etc. (optional) */
  linearFactor?: number;
  wastePercent?: number;
  /** Optional cost rate for amount = qty × rate */
  rate?: number;
  color: string;
  notes?: string;
  /** Created from Sheet AI flows (cleared with clearSheetAiFromDrawing). */
  fromSheetAi?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type TakeoffZone = {
  id: string;
  itemId: string;
  pageIndex: number;
  /** Normalized 0–1 coordinates (same as annotations) */
  points: { x: number; y: number }[];
  measurementType: TakeoffMeasurementType;
  /** Raw geometry-derived quantity (before waste/formula) */
  rawQuantity: number;
  /** After waste % and optional linear factor */
  computedQuantity: number;
  notes?: string;
  tags?: string[];
  locked?: boolean;
  /** Zone tagged from Sheet AI (cleared with clearSheetAiFromDrawing). */
  fromSheetAi?: boolean;
  createdBy: string;
  createdAt: number;
  editedBy?: string;
  editedAt?: number;
};

export type TakeoffPendingGeometry = {
  kind: TakeoffMeasurementType;
  pageIndex: number;
  points: { x: number; y: number }[];
  /** Precomputed from calibration */
  rawQuantity: number;
  computedQuantity: number;
};

export type TakeoffAnomaly = {
  id: string;
  severity: "info" | "warning";
  message: string;
  zoneIds?: string[];
};

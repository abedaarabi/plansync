/** Shared BIM clash detection types (API + viewer). */

export type BimClashSetField = "model" | "discipline" | "ifcType" | "level";

export type BimClashSetRule = {
  field: BimClashSetField;
  values: string[];
};

export type BimClashSetDef = {
  label: string;
  rules: BimClashSetRule[];
};

export type BimClashType = "HARD" | "CLEARANCE" | "DUPLICATE";

export type BimClashStatus = "NEW" | "ACTIVE" | "RESOLVED" | "IGNORED";

export type BimClashPoint = { x: number; y: number; z: number };

export type BimClashHit = {
  guidA: string;
  guidB: string;
  fileVersionIdA: string;
  fileVersionIdB: string;
  clashType: BimClashType;
  distanceMm: number;
  point: BimClashPoint;
  contactCount: number;
  /** Optional display metadata from the viewer quantity index. */
  nameA?: string | null;
  nameB?: string | null;
  ifcTypeA?: string | null;
  ifcTypeB?: string | null;
};

export type BimClashRunPayload = {
  clearanceEnabled: boolean;
  clearanceMm: number;
  setA: BimClashSetDef;
  setB: BimClashSetDef;
  hits: BimClashHit[];
  scannedPairs: number;
  truncated: boolean;
};

export type BimClashRunStats = {
  newCount: number;
  reopenedCount: number;
  stillClashing: number;
  noLongerClashing: number;
  orphaned: number;
};

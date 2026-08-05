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

/** Which clash types a run should report (Navis-style separate passes). */
export type BimClashRunMode = "HARD" | "CLEARANCE" | "BOTH";

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
  /** Closest point on element A (world) — for clearance gap markers. */
  closestA?: BimClashPoint;
  /** Closest point on element B (world) — for clearance gap markers. */
  closestB?: BimClashPoint;
  /** Optional display metadata from the viewer quantity index. */
  nameA?: string | null;
  nameB?: string | null;
  ifcTypeA?: string | null;
  ifcTypeB?: string | null;
};

export type BimClashRunPayload = {
  clearanceEnabled: boolean;
  clearanceMm: number;
  /** Optional; derived from clearanceEnabled when omitted. */
  runMode?: BimClashRunMode;
  setA: BimClashSetDef;
  setB: BimClashSetDef;
  hits: BimClashHit[];
  scannedPairs: number;
  truncated: boolean;
};

export function runModeNeedsClearance(mode: BimClashRunMode): boolean {
  return mode !== "HARD";
}

export function runModeFromClearanceEnabled(clearanceEnabled: boolean): BimClashRunMode {
  return clearanceEnabled ? "BOTH" : "HARD";
}

export function filterHitsByRunMode(hits: BimClashHit[], mode: BimClashRunMode): BimClashHit[] {
  if (mode === "BOTH") return hits;
  if (mode === "HARD") {
    return hits.filter((h) => h.clashType === "HARD" || h.clashType === "DUPLICATE");
  }
  return hits.filter((h) => h.clashType === "CLEARANCE" || h.clashType === "DUPLICATE");
}

export type BimClashRunStats = {
  newCount: number;
  reopenedCount: number;
  stillClashing: number;
  noLongerClashing: number;
  orphaned: number;
};

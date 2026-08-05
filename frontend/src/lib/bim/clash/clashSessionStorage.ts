import type {
  BimClashRunMode,
  BimClashSetDef,
  BimClashStatus,
  BimClashType,
} from "@plansync/shared/bimClashTypes";
import { runModeFromClearanceEnabled } from "@plansync/shared/bimClashTypes";

const STORAGE_KEY = "plansync-bim-clash-session";
/** v4: runMode + typeFilter. */
const STORAGE_VERSION = 4;

/** How the rest of the building is shown while reviewing a clash. */
export type ClashContextMode = "color" | "ghost" | "hide";

export type ClashSessionState = {
  testId: string | null;
  statusFilter: BimClashStatus | "ALL" | "ORPHANED" | "STALE";
  typeFilter: BimClashType | "ALL";
  assigneeMe: boolean;
  grouped: boolean;
  focusMode: boolean;
  contextMode: ClashContextMode;
  setA: BimClashSetDef | null;
  setB: BimClashSetDef | null;
  clearanceEnabled: boolean;
  clearanceMm: number;
  runMode: BimClashRunMode;
};

const DEFAULT_SESSION: ClashSessionState = {
  testId: null,
  statusFilter: "ALL",
  typeFilter: "ALL",
  assigneeMe: false,
  grouped: true,
  focusMode: true,
  contextMode: "ghost",
  setA: null,
  setB: null,
  clearanceEnabled: true,
  clearanceMm: 25,
  runMode: "BOTH",
};

function parseContextMode(value: unknown): ClashContextMode {
  if (value === "color" || value === "ghost" || value === "hide") return value;
  return DEFAULT_SESSION.contextMode;
}

function parseRunMode(value: unknown, clearanceEnabled: boolean): BimClashRunMode {
  if (value === "HARD" || value === "CLEARANCE" || value === "BOTH") return value;
  return runModeFromClearanceEnabled(clearanceEnabled);
}

function parseTypeFilter(value: unknown): BimClashType | "ALL" {
  if (value === "HARD" || value === "CLEARANCE" || value === "DUPLICATE" || value === "ALL") {
    return value;
  }
  return "ALL";
}

export function readClashSession(projectId: string): ClashSessionState {
  if (typeof window === "undefined") return { ...DEFAULT_SESSION };
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
    if (!raw) return { ...DEFAULT_SESSION };
    const parsed = JSON.parse(raw) as { v?: number } & Partial<ClashSessionState> & {
        clearanceEnabled?: boolean;
      };
    // v2→v3: keep sets/filters; switch default context from Color → Ghost.
    if (parsed.v === 2) {
      const clearanceEnabled = parsed.clearanceEnabled ?? DEFAULT_SESSION.clearanceEnabled;
      return {
        ...DEFAULT_SESSION,
        ...parsed,
        contextMode: "ghost",
        runMode: parseRunMode(parsed.runMode, clearanceEnabled),
        typeFilter: parseTypeFilter(parsed.typeFilter),
      };
    }
    if (parsed.v === 3) {
      const clearanceEnabled = parsed.clearanceEnabled ?? DEFAULT_SESSION.clearanceEnabled;
      return {
        ...DEFAULT_SESSION,
        ...parsed,
        contextMode: parseContextMode(parsed.contextMode),
        runMode: parseRunMode(parsed.runMode, clearanceEnabled),
        typeFilter: parseTypeFilter(parsed.typeFilter),
      };
    }
    if (parsed.v !== STORAGE_VERSION) return { ...DEFAULT_SESSION };
    const clearanceEnabled = parsed.clearanceEnabled ?? DEFAULT_SESSION.clearanceEnabled;
    return {
      ...DEFAULT_SESSION,
      ...parsed,
      contextMode: parseContextMode(parsed.contextMode),
      runMode: parseRunMode(parsed.runMode, clearanceEnabled),
      typeFilter: parseTypeFilter(parsed.typeFilter),
    };
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

export function writeClashSession(projectId: string, state: ClashSessionState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY}:${projectId}`,
      JSON.stringify({ v: STORAGE_VERSION, ...state }),
    );
  } catch {
    /* ignore quota */
  }
}

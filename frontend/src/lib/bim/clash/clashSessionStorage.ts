import type { BimClashSetDef, BimClashStatus } from "@plansync/shared/bimClashTypes";

const STORAGE_KEY = "plansync-bim-clash-session";
/** v3: Ghost is the default clash context (faded federation + solid pair). */
const STORAGE_VERSION = 3;

/** How the rest of the building is shown while reviewing a clash. */
export type ClashContextMode = "color" | "ghost" | "hide";

export type ClashSessionState = {
  testId: string | null;
  statusFilter: BimClashStatus | "ALL" | "ORPHANED" | "STALE";
  assigneeMe: boolean;
  grouped: boolean;
  focusMode: boolean;
  contextMode: ClashContextMode;
  setA: BimClashSetDef | null;
  setB: BimClashSetDef | null;
  clearanceEnabled: boolean;
  clearanceMm: number;
};

const DEFAULT_SESSION: ClashSessionState = {
  testId: null,
  statusFilter: "ALL",
  assigneeMe: false,
  grouped: true,
  focusMode: true,
  contextMode: "ghost",
  setA: null,
  setB: null,
  clearanceEnabled: true,
  clearanceMm: 25,
};

function parseContextMode(value: unknown): ClashContextMode {
  if (value === "color" || value === "ghost" || value === "hide") return value;
  return DEFAULT_SESSION.contextMode;
}

export function readClashSession(projectId: string): ClashSessionState {
  if (typeof window === "undefined") return { ...DEFAULT_SESSION };
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${projectId}`);
    if (!raw) return { ...DEFAULT_SESSION };
    const parsed = JSON.parse(raw) as { v?: number } & Partial<ClashSessionState>;
    // v2→v3: keep sets/filters; switch default context from Color → Ghost.
    if (parsed.v === 2) {
      return {
        ...DEFAULT_SESSION,
        ...parsed,
        contextMode: "ghost",
        v: undefined,
      } as ClashSessionState;
    }
    if (parsed.v !== STORAGE_VERSION) return { ...DEFAULT_SESSION };
    return {
      ...DEFAULT_SESSION,
      ...parsed,
      contextMode: parseContextMode(parsed.contextMode),
      v: undefined,
    } as ClashSessionState;
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

export type BimWalkPlanSize = "off" | "mini" | "big";

export const BIM_WALK_PLAN_SIZE_OPTIONS: {
  id: BimWalkPlanSize;
  label: string;
}[] = [
  { id: "off", label: "Off" },
  { id: "mini", label: "Mini" },
  { id: "big", label: "Big" },
];

const STORAGE_KEY = "plansync-bim-walk-plan-size";
const SPLIT_STORAGE_KEY = "plansync-bim-split-view";
const SIZE_IDS = new Set<BimWalkPlanSize>(["off", "mini", "big"]);

function isWalkPlanSize(value: unknown): value is BimWalkPlanSize {
  return typeof value === "string" && SIZE_IDS.has(value as BimWalkPlanSize);
}

/** Default: Mini so walk keeps full-bleed 3D with a corner plan. */
export function defaultWalkPlanSize(): BimWalkPlanSize {
  return "mini";
}

export function readSavedWalkPlanSize(): BimWalkPlanSize {
  if (typeof window === "undefined") return defaultWalkPlanSize();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWalkPlanSize();
    const parsed = JSON.parse(raw) as { size?: unknown };
    return isWalkPlanSize(parsed.size) ? parsed.size : defaultWalkPlanSize();
  } catch {
    return defaultWalkPlanSize();
  }
}

export function writeSavedWalkPlanSize(size: BimWalkPlanSize): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ size }));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readSavedSplitView(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return readSavedWalkPlanSize() === "big";
  } catch {
    return false;
  }
}

export function writeSavedSplitView(open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

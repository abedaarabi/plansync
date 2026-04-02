import type { BottomDrawerSnap } from "@/lib/bottomDrawerSnap";

const STORAGE_V = 1 as const;

export type PersistedInventoryDrawerState = {
  v: typeof STORAGE_V;
  snap: BottomDrawerSnap;
  inventoryFullscreen: boolean;
};

export function inventoryDrawerStorageKey(fileFingerprint: string): string {
  return `plansync-inventory-drawer-v${STORAGE_V}:${fileFingerprint}`;
}

export function loadInventoryDrawerState(
  fileFingerprint: string,
): PersistedInventoryDrawerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(inventoryDrawerStorageKey(fileFingerprint));
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedInventoryDrawerState>;
    if (parsed.v !== STORAGE_V) return null;
    if (parsed.snap !== "collapsed" && parsed.snap !== "half" && parsed.snap !== "full") {
      return null;
    }
    return {
      v: STORAGE_V,
      snap: parsed.snap,
      inventoryFullscreen: Boolean(parsed.inventoryFullscreen),
    };
  } catch {
    return null;
  }
}

export function saveInventoryDrawerState(
  fileFingerprint: string,
  state: Omit<PersistedInventoryDrawerState, "v">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedInventoryDrawerState = { v: STORAGE_V, ...state };
    localStorage.setItem(inventoryDrawerStorageKey(fileFingerprint), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export type ViewerRailTabId =
  | "draw"
  | "measure"
  | "calibrate"
  | "pages"
  | "outline"
  | "issues"
  | "takeoff"
  | "sheetAi"
  | "collab";

export type ViewerRailPersisted = {
  tab: ViewerRailTabId;
  dockOpen: boolean;
};

const STORAGE_KEY = "plansync.viewer.railDock.v1";

const VALID_TABS = new Set<ViewerRailTabId>([
  "draw",
  "measure",
  "calibrate",
  "pages",
  "outline",
  "issues",
  "takeoff",
  "sheetAi",
  "collab",
]);

export function loadViewerRailState(): ViewerRailPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ViewerRailPersisted>;
    if (!parsed.tab || !VALID_TABS.has(parsed.tab)) return null;
    return { tab: parsed.tab, dockOpen: Boolean(parsed.dockOpen) };
  } catch {
    return null;
  }
}

export function saveViewerRailState(state: ViewerRailPersisted): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

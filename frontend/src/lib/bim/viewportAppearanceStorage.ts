import {
  BIM_COLOR_MODE_OPTIONS,
  BIM_ENVIRONMENT_OPTIONS,
  BIM_FOG_MODE_OPTIONS,
  BIM_GRID_MODE_OPTIONS,
  BIM_SPACE_DISPLAY_OPTIONS,
  DEFAULT_BIM_VIEWPORT_APPEARANCE,
  mergeViewportAppearance,
  type BimViewportAppearance,
} from "@/lib/bim/viewportAppearance";

const STORAGE_KEY = "plansync-bim-viewport-appearance";
const STORAGE_VERSION = 1;

const ENV_IDS = new Set(BIM_ENVIRONMENT_OPTIONS.map((o) => o.id));
const COLOR_IDS = new Set(BIM_COLOR_MODE_OPTIONS.map((o) => o.id));
const SPACE_IDS = new Set(BIM_SPACE_DISPLAY_OPTIONS.map((o) => o.id));
const FOG_IDS = new Set(BIM_FOG_MODE_OPTIONS.map((o) => o.id));
const GRID_IDS = new Set(BIM_GRID_MODE_OPTIONS.map((o) => o.id));

function pick<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

/** Validates and merges persisted JSON with current defaults. */
function parseViewportAppearance(raw: unknown): BimViewportAppearance {
  const base = { ...DEFAULT_BIM_VIEWPORT_APPEARANCE };
  if (!raw || typeof raw !== "object") return base;

  const input = raw as Partial<BimViewportAppearance>;
  return mergeViewportAppearance(base, {
    environment: pick(input.environment, ENV_IDS, base.environment),
    colorMode: pick(input.colorMode, COLOR_IDS, base.colorMode),
    spaceDisplay: pick(input.spaceDisplay, SPACE_IDS, base.spaceDisplay),
    fogMode: pick(input.fogMode, FOG_IDS, base.fogMode),
    gridMode: pick(input.gridMode, GRID_IDS, base.gridMode),
  });
}

/** Load viewport appearance from localStorage (browser-only). */
// fallow-ignore-next-line complexity
export function readSavedViewportAppearance(): BimViewportAppearance {
  if (typeof window === "undefined") return { ...DEFAULT_BIM_VIEWPORT_APPEARANCE };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_BIM_VIEWPORT_APPEARANCE };
    const parsed = JSON.parse(stored) as { v?: number; appearance?: unknown };
    if (parsed.v !== STORAGE_VERSION) {
      return parseViewportAppearance(parsed.appearance);
    }
    return parseViewportAppearance(parsed.appearance);
  } catch {
    return { ...DEFAULT_BIM_VIEWPORT_APPEARANCE };
  }
}

/** Persist viewport appearance to localStorage. */
export function writeSavedViewportAppearance(appearance: BimViewportAppearance): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, appearance }));
  } catch {
    /* Private mode / quota — appearance still applies for this session. */
  }
}

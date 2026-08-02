import type { BimClashStatus, BimClashType } from "@plansync/shared/bimClashTypes";

/** Navisworks Clash Detective defaults: Item 1 green, Item 2 red. */
export const CLASH_ITEM1_COLOR = "#00af00";
export const CLASH_ITEM2_COLOR = "#ff0000";
/** Scene-wide material opacity while reviewing (context ghost). Near-invisible so Item 1/2 dominate. */
export const CLASH_SCENE_GHOST_OPACITY = 0.06;

export function clashStatusLabel(status: BimClashStatus): string {
  switch (status) {
    case "NEW":
      return "New";
    case "ACTIVE":
      return "Active";
    case "RESOLVED":
      return "Resolved";
    case "IGNORED":
      return "Ignored";
    default:
      return status;
  }
}

export function clashTypeLabel(type: BimClashType): string {
  switch (type) {
    case "HARD":
      return "Hard";
    case "CLEARANCE":
      return "Clearance";
    case "DUPLICATE":
      return "Duplicate";
    default:
      return type;
  }
}

export function formatClashDistanceMm(distanceMm: number): string {
  if (!Number.isFinite(distanceMm)) return "—";
  if (Math.abs(distanceMm) < 0.05) return "0 mm";
  const rounded = Math.round(distanceMm * 10) / 10;
  return `${rounded} mm`;
}

/** Human label for review HUD: penetration vs clearance gap. */
export function formatClashDistanceDetail(type: BimClashType, distanceMm: number): string {
  const value = formatClashDistanceMm(distanceMm);
  if (type === "HARD") return `Penetration ${value}`;
  if (type === "CLEARANCE") return `Gap ${value}`;
  return value;
}

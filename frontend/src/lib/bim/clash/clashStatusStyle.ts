import type { BimClashStatus, BimClashType } from "@plansync/shared/bimClashTypes";

/** Navisworks Clash Detective defaults: Item 1 green, Item 2 red. */
export const CLASH_ITEM1_COLOR = "#00af00";
export const CLASH_ITEM2_COLOR = "#ff0000";
/** Clearance gap marker (soft clash). */
export const CLASH_CLEARANCE_MARKER_COLOR = "#f59e0b";
/** Hard contact marker. */
export const CLASH_HARD_MARKER_COLOR = "#ef4444";
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

/** Badge tone for clash type chips. */
export function clashTypeBadgeClass(type: BimClashType): string {
  switch (type) {
    case "HARD":
      return "bg-[var(--bim-danger)]/15 text-[var(--bim-danger)]";
    case "CLEARANCE":
      return "bg-[var(--bim-warning)]/15 text-[var(--bim-warning)]";
    case "DUPLICATE":
      return "bg-[var(--bim-info)]/15 text-[var(--bim-info)]";
    default:
      return "bg-[var(--bim-hover)] text-[var(--bim-text-muted)]";
  }
}

function formatClashDistanceMm(distanceMm: number): string {
  if (!Number.isFinite(distanceMm)) return "—";
  if (Math.abs(distanceMm) < 0.05) return "0 mm";
  const rounded = Math.round(Math.abs(distanceMm) * 10) / 10;
  const sign = distanceMm < 0 ? "−" : "";
  return `${sign}${rounded} mm`;
}

/** Human label for review HUD: penetration vs clearance gap. */
export function formatClashDistanceDetail(type: BimClashType, distanceMm: number): string {
  const value = formatClashDistanceMm(distanceMm);
  if (type === "HARD") return `Penetration ${value}`;
  if (type === "CLEARANCE") return `Gap ${value}`;
  return value;
}

/** Shared issue status labels and chip styles (viewer + enterprise). */

export const ISSUE_STATUS_ORDER = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type IssueStatusKey = (typeof ISSUE_STATUS_ORDER)[number];

export const ISSUE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const ISSUE_PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH"] as const;
export type IssuePriorityKey = (typeof ISSUE_PRIORITY_ORDER)[number];

export const ISSUE_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

/** `YYYY-MM-DD` for `<input type="date" />` from API ISO strings (stored as UTC noon). */
export function issueDateToInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compact labels for segmented controls and narrow sidebars. */
export const ISSUE_STATUS_SHORT: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "Active",
  RESOLVED: "Done",
  CLOSED: "Closed",
};

/** Tailwind class strings for compact badges. */
export const ISSUE_STATUS_BADGE_CLASS: Record<string, string> = {
  OPEN: "bg-red-500/20 text-red-200 ring-1 ring-red-500/35",
  IN_PROGRESS: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35",
  RESOLVED: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/35",
  CLOSED: "bg-slate-600/40 text-slate-200 ring-1 ring-slate-500/30",
};

export function issueStatusBadgeClass(status: string): string {
  return ISSUE_STATUS_BADGE_CLASS[status] ?? ISSUE_STATUS_BADGE_CLASS.CLOSED;
}

/** Badges on light backgrounds (e.g. enterprise tables). */
export const ISSUE_STATUS_BADGE_CLASS_LIGHT: Record<string, string> = {
  OPEN: "bg-red-50 text-red-800 ring-1 ring-red-200/80",
  IN_PROGRESS: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
  RESOLVED: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80",
  CLOSED: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/90",
};

export function issueStatusBadgeClassLight(status: string): string {
  return ISSUE_STATUS_BADGE_CLASS_LIGHT[status] ?? ISSUE_STATUS_BADGE_CLASS_LIGHT.CLOSED;
}

/**
 * Solid issue-pin color (field / punch style), not a translucent markup fill.
 * Used for the on-sheet dot and for `Annotation.color` persistence.
 */
export function issueStatusDotSolidFill(status: string): string {
  switch (status) {
    case "OPEN":
      return "#dc2626";
    case "IN_PROGRESS":
      return "#d97706";
    case "RESOLVED":
      return "#059669";
    case "CLOSED":
      return "#475569";
    default:
      return "#475569";
  }
}

/** Dot + halo radii in SVG/CSS pixels — scale slightly with zoom so pins track the sheet. */
export function issueStatusDotRadii(cssW: number, cssH: number): { core: number; halo: number } {
  const m = Math.min(cssW, cssH);
  const core = Math.max(5.75, Math.min(12, m * 0.0052));
  const halo = core + Math.max(2, core * 0.38);
  return { core, halo };
}

/** Persisted stroke / tint on `Annotation.color` (matches on-sheet dot fill). */
export function issueStatusMarkerStrokeHex(status: string): string {
  return issueStatusDotSolidFill(status);
}

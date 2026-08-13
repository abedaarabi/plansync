import type { IssueRow } from "@/lib/api-client/core-issues-takeoff";
import { ISSUE_PRIORITY_LABEL, issuePriorityPinAccent } from "@/lib/issueStatusStyle";

type IssueNumberSource = Pick<IssueRow, "id" | "displayNumber">;

function hashIssueNumber(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 9999) + 1;
}

function resolveIssueDisplayNumber(issue: IssueNumberSource): number {
  if (issue.displayNumber != null && Number.isFinite(issue.displayNumber)) {
    return issue.displayNumber;
  }
  return hashIssueNumber(issue.id);
}

/** Stable display code for cards (e.g. "ISS-0241"). */
export function issueDisplayCode(issue: IssueNumberSource): string {
  return `ISS-${String(resolveIssueDisplayNumber(issue)).padStart(4, "0")}`;
}

/** Short number for pin face (e.g. "24" or "241"). */
export function issuePinDisplayNumber(
  issue: IssueNumberSource & { issueKind?: string | null; workOrderNumber?: number | null },
): string {
  if (
    issue.issueKind === "WORK_ORDER" &&
    issue.workOrderNumber != null &&
    Number.isFinite(issue.workOrderNumber)
  ) {
    const n = issue.workOrderNumber;
    return n > 999 ? String(n % 1000) : String(n);
  }
  const n = resolveIssueDisplayNumber(issue);
  return n > 999 ? String(n % 1000) : String(n);
}

/** Left-edge accent on floating cards. */
export function issuePriorityAccentColor(priority: string | undefined | null): string {
  return issuePriorityPinAccent(priority);
}

export function issuePriorityLabel(priority: string | undefined | null): string {
  const k = (priority ?? "MEDIUM").toUpperCase();
  return ISSUE_PRIORITY_LABEL[k] ?? k.replace(/_/g, " ");
}

// fallow-ignore-next-line complexity
export function issuePriorityBadgeClass(priority: string | undefined | null): string {
  switch ((priority ?? "MEDIUM").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "bg-[color-mix(in_srgb,var(--bim-danger)_16%,transparent)] text-[var(--bim-danger)] ring-1 ring-[color-mix(in_srgb,var(--bim-danger)_32%,transparent)]";
    case "LOW":
      return "bg-[var(--bim-hover)] text-[var(--bim-text-muted)] ring-1 ring-[var(--bim-border)]";
    case "MEDIUM":
    default:
      return "bg-[color-mix(in_srgb,var(--bim-warning)_16%,transparent)] text-[var(--bim-warning)] ring-1 ring-[color-mix(in_srgb,var(--bim-warning)_32%,transparent)]";
  }
}

/** Pill styling for issue kind on dark BIM surfaces. */
export function issueKindBadgeClass(_kind: string | undefined | null): string {
  return "bg-[color-mix(in_srgb,var(--bim-accent)_14%,transparent)] text-[var(--bim-text-muted)] ring-1 ring-[color-mix(in_srgb,var(--bim-accent)_28%,transparent)]";
}

// fallow-ignore-next-line complexity
export function issueKindDisplayLabel(kind: string | undefined | null): string {
  switch ((kind ?? "CONSTRUCTION").toUpperCase()) {
    case "WORK_ORDER":
      return "Work order";
    case "OCCUPANT":
      return "Occupant";
    case "CONSTRUCTION":
    default:
      return "Construction";
  }
}

// fallow-ignore-next-line complexity
export function issueAttachmentCount(issue: IssueRow): number {
  return (
    (issue.referencePhotos?.length ?? 0) +
    (issue.attachedMarkupAnnotationIds?.length ?? 0) +
    (issue.linkedRfis?.length ?? 0)
  );
}

export function issueCommentCount(issue: IssueRow): number {
  return issue.commentCount ?? 0;
}

export function issueLocationLabel(issue: IssueRow): string | null {
  const loc = issue.location?.trim();
  if (loc) return loc;
  const path = issue.bimAnchor?.spatialPath?.filter(Boolean);
  if (path?.length) return path.join(" • ");
  return null;
}

// fallow-ignore-next-line complexity
export function issueUserInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export const BIM_ISSUE_MARKER_CARD_W = 360;
export const BIM_ISSUE_MARKER_CARD_MAX_H = 440;
const BIM_ISSUE_MARKER_CLUSTER_RADIUS = 52;

export type ProjectedIssuePin = {
  id: string;
  issue: IssueRow;
  x: number;
  y: number;
  visible: boolean;
};

export type IssueMarkerCluster = {
  kind: "cluster";
  id: string;
  pins: ProjectedIssuePin[];
  x: number;
  y: number;
};

export type IssueMarkerItem = { kind: "pin"; pin: ProjectedIssuePin } | IssueMarkerCluster;

function clusterKey(pins: ProjectedIssuePin[]): string {
  return pins
    .map((p) => p.id)
    .sort()
    .join(",");
}

// fallow-ignore-next-line complexity
export function clusterIssuePins(
  pins: ProjectedIssuePin[],
  expandedClusterIds: ReadonlySet<string>,
): IssueMarkerItem[] {
  const visible = pins.filter((p) => p.visible);
  const used = new Set<string>();
  const items: IssueMarkerItem[] = [];

  for (const seed of visible) {
    if (used.has(seed.id)) continue;

    const group = visible.filter(
      (p) =>
        !used.has(p.id) &&
        Math.hypot(p.x - seed.x, p.y - seed.y) <= BIM_ISSUE_MARKER_CLUSTER_RADIUS,
    );

    if (group.length <= 1) {
      used.add(seed.id);
      items.push({ kind: "pin", pin: seed });
      continue;
    }

    const key = clusterKey(group);
    if (expandedClusterIds.has(key)) {
      for (const pin of group) {
        used.add(pin.id);
        items.push({ kind: "pin", pin });
      }
      continue;
    }

    const x = group.reduce((s, p) => s + p.x, 0) / group.length;
    const y = group.reduce((s, p) => s + p.y, 0) / group.length;
    group.forEach((p) => used.add(p.id));
    items.push({ kind: "cluster", id: key, pins: group, x, y });
  }

  return items;
}

export type CardPlacement = {
  left: number;
  top: number;
  leaderFrom: { x: number; y: number };
  leaderTo: { x: number; y: number };
};

/** Place card above the pin when possible; clamp inside viewport. */
export function computeIssueMarkerCardPlacement(
  pinX: number,
  pinY: number,
  viewportW: number,
  viewportH: number,
  cardW = BIM_ISSUE_MARKER_CARD_W,
  cardH = BIM_ISSUE_MARKER_CARD_MAX_H,
): CardPlacement {
  const pad = 12;
  const gap = 72;

  let left = pinX - cardW / 2;
  let top = pinY - gap - cardH;

  left = Math.max(pad, Math.min(left, viewportW - cardW - pad));

  if (top < pad) {
    top = pinY + gap;
  }
  top = Math.max(pad, Math.min(top, viewportH - cardH - pad));

  const leaderToX = Math.max(left + 24, Math.min(left + cardW - 24, pinX));
  const leaderToY = top >= pinY ? top : top + cardH;

  return {
    left,
    top,
    leaderFrom: { x: pinX, y: pinY - 6 },
    leaderTo: { x: leaderToX, y: leaderToY },
  };
}

export function formatIssueDueDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** True when due date is before today and issue is still open/active. */
// fallow-ignore-next-line complexity
export function isIssueDueOverdue(issue: Pick<IssueRow, "dueDate" | "status">): boolean {
  if (!issue.dueDate?.trim()) return false;
  const st = issue.status.toUpperCase();
  if (st === "RESOLVED" || st === "CLOSED") return false;
  const due = new Date(issue.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

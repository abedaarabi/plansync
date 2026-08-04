import { IssueKind, IssuePriority, IssueStatus } from "@prisma/client";

export const ISSUES_CHAT_CARD_LIMIT = 12;
export const ISSUES_CHAT_CATALOG_LIMIT = 120;

const CLOSED_LIKE = new Set<string>([IssueStatus.RESOLVED, IssueStatus.CLOSED]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "me",
  "my",
  "all",
  "every",
  "give",
  "show",
  "list",
  "get",
  "find",
  "filter",
  "by",
  "about",
  "please",
  "issue",
  "issues",
  "project",
  "with",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
]);

type ChatIssueRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  issueKind: IssueKind;
  assigneeId: string | null;
  dueDate: Date | null;
  location: string | null;
  sheetName: string | null;
  bimAnchor: unknown;
  externalAssigneeName: string | null;
  assignee: { name: string | null } | null;
  file: { name: string } | null;
};

function issueDueDayStartMs(due: Date | null): number | null {
  if (!due) return null;
  return Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
}

export function isIssueRowOverdue(
  row: { status: string; dueDate: Date | null },
  nowMs: number,
): boolean {
  if (CLOSED_LIKE.has(row.status)) return false;
  const dueStart = issueDueDayStartMs(row.dueDate);
  if (dueStart == null) return false;
  const now = new Date(nowMs);
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueStart < todayStart;
}

function issueLooksClashRelated(
  row: { id: string; title: string; description: string | null; bimAnchor: unknown },
  clashIssueIds: Set<string>,
): boolean {
  if (clashIssueIds.has(row.id)) return true;
  if (row.bimAnchor != null) return true;
  const blob = `${row.title ?? ""} ${row.description ?? ""}`.toLowerCase();
  return /\bclash(ed|es|ing)?\b|\bbim\b/.test(blob);
}

export function catalogRank(
  row: { status: string; priority: string; dueDate: Date | null },
  nowMs: number,
): number {
  let score = 0;
  if (row.status === IssueStatus.OPEN) score += 4;
  else if (row.status === IssueStatus.IN_PROGRESS) score += 3;
  if (row.priority === IssuePriority.HIGH) score += 2;
  if (isIssueRowOverdue(row, nowMs)) score += 2;
  return score;
}

function parseStatus(q: string): IssueStatus | null {
  if (/\bin progress\b|\bin_progress\b|\bactive\b/.test(q)) return IssueStatus.IN_PROGRESS;
  if (/\bresolved\b|\bdone\b/.test(q)) return IssueStatus.RESOLVED;
  if (/\bclosed\b/.test(q)) return IssueStatus.CLOSED;
  if (/\bopen\b/.test(q)) return IssueStatus.OPEN;
  return null;
}

function issueHaystack(row: ChatIssueRow, displayNums: Map<string, number>): string {
  return [
    row.title,
    row.description,
    row.location,
    row.sheetName,
    row.file?.name,
    row.assignee?.name,
    row.externalAssigneeName,
    displayNums.get(row.id)?.toString(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tokensMatch(hay: string, raw: string): boolean {
  const tokens = raw.split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  if (!tokens.length) return true;
  return tokens.every((tok) => hay.includes(tok));
}

function stripIntentWords(q: string): string {
  return q
    .replace(/\boverdue\b/g, " ")
    .replace(/\b(my issues|assigned to me|assigned me|assigned to myself)\b/g, " ")
    .replace(/\b(unassigned|no assignee)\b/g, " ")
    .replace(/\b(high priority|urgent|critical|medium priority|low priority)\b/g, " ")
    .replace(/\bclash(ed|es|ing)?\b|\bbim clash\b/g, " ")
    .replace(/\bwork[\s-]?orders?\b/g, " ")
    .replace(/\b(occupant|tenant|construction)\b/g, " ")
    .replace(/\bin progress\b|\bin_progress\b|\bactive\b/g, " ")
    .replace(/\b(resolved|done|closed|open)\b/g, " ")
    .replace(/\b(all|every|entire|full|give|show|list|get|find|filter|by|please)\b/g, " ")
    .replace(/#?\d{1,6}/g, " ")
    .replace(/\bissues?\b/g, " ")
    .trim();
}

type Intent = {
  wantOverdue: boolean;
  wantMine: boolean;
  wantUnassigned: boolean;
  wantHigh: boolean;
  wantMedium: boolean;
  wantLow: boolean;
  wantClash: boolean;
  wantWorkOrder: boolean;
  wantOccupant: boolean;
  wantConstruction: boolean;
  statusMatch: IssueStatus | null;
  displayNum: number | null;
  wantAll: boolean;
  hasFilter: boolean;
};

function parseIntent(q: string): Intent {
  const wantOverdue = /\boverdue\b/.test(q);
  const wantMine =
    /\b(my issues|assigned to me|assigned me|assigned to myself|only mine)\b/.test(q) ||
    /\bmine\b/.test(q);
  const wantUnassigned = /\bunassigned\b|\bno assignee\b/.test(q);
  const wantHigh = /\b(high priority|urgent|critical)\b/.test(q);
  const wantMedium = /\bmedium priority\b/.test(q);
  const wantLow = /\blow priority\b/.test(q);
  const wantClash = /\bclash(ed|es|ing)?\b|\bbim clash\b/.test(q);
  const wantWorkOrder = /\bwork[\s-]?orders?\b/.test(q);
  const wantOccupant = /\b(occupant|tenant)\b/.test(q);
  const wantConstruction = /\bconstruction\b/.test(q);
  const statusMatch = parseStatus(q);
  const numMatch = /(?:^|\s)#?(\d{1,6})\b/.exec(q);
  const displayNum = numMatch ? Number(numMatch[1]) : null;
  const wantAll =
    /\b(all|every|entire|full)\b/.test(q) ||
    /\b(give|show|list|get)\b.+\bissues?\b/.test(q) ||
    /^(issues?|all issues?)$/.test(q);
  const hasFilter =
    wantOverdue ||
    wantMine ||
    wantUnassigned ||
    wantHigh ||
    wantMedium ||
    wantLow ||
    wantClash ||
    wantWorkOrder ||
    wantOccupant ||
    wantConstruction ||
    statusMatch != null ||
    displayNum != null;
  return {
    wantOverdue,
    wantMine,
    wantUnassigned,
    wantHigh,
    wantMedium,
    wantLow,
    wantClash,
    wantWorkOrder,
    wantOccupant,
    wantConstruction,
    statusMatch,
    displayNum,
    wantAll,
    hasFilter,
  };
}

function passesStructuredFilters(
  row: ChatIssueRow,
  intent: Intent,
  userId: string,
  nowMs: number,
  clashIssueIds: Set<string>,
): boolean {
  const checks: Array<[boolean, boolean]> = [
    [intent.wantOverdue, isIssueRowOverdue(row, nowMs)],
    [intent.wantMine, row.assigneeId === userId],
    [intent.wantUnassigned, !row.assigneeId],
    [intent.wantHigh, row.priority === IssuePriority.HIGH],
    [intent.wantMedium, row.priority === IssuePriority.MEDIUM],
    [intent.wantLow, row.priority === IssuePriority.LOW],
    [intent.wantClash, issueLooksClashRelated(row, clashIssueIds)],
    [intent.wantWorkOrder, row.issueKind === IssueKind.WORK_ORDER],
    [intent.wantOccupant, row.issueKind === IssueKind.OCCUPANT],
    [intent.wantConstruction, row.issueKind === IssueKind.CONSTRUCTION],
    [intent.statusMatch != null, row.status === intent.statusMatch],
  ];
  return checks.every(([required, ok]) => !required || ok);
}

/** Heuristic fallback when the model returns no usable issue ids. */
export function matchIssuesForQuery<T extends ChatIssueRow>(
  rows: T[],
  displayNums: Map<string, number>,
  query: string,
  userId: string,
  nowMs: number,
  clashIssueIds: Set<string>,
): { matched: T[]; totalMatched: number } {
  const q = query.trim().toLowerCase();
  if (!q) return { matched: [], totalMatched: 0 };

  const intent = parseIntent(q);
  const filtered = rows.filter((row) => {
    if (!passesStructuredFilters(row, intent, userId, nowMs, clashIssueIds)) return false;
    if (intent.displayNum != null && displayNums.get(row.id) === intent.displayNum) return true;

    const hay = issueHaystack(row, displayNums);
    if (intent.wantAll || intent.hasFilter) {
      const stripped = stripIntentWords(q);
      if (!stripped) return true;
      return tokensMatch(hay, stripped);
    }
    return tokensMatch(hay, q) || hay.includes(q);
  });

  const result =
    filtered.length === 0 && intent.wantAll
      ? [...rows].sort((a, b) => catalogRank(b, nowMs) - catalogRank(a, nowMs))
      : filtered;

  return {
    matched: result.slice(0, ISSUES_CHAT_CARD_LIMIT),
    totalMatched: filtered.length === 0 && intent.wantAll ? rows.length : filtered.length,
  };
}

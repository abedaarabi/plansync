import type { ProposalListRow } from "@/lib/api-client";

export type ProposalsOverviewFilter =
  | "ALL"
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CHANGE_REQUESTED"
  | "EXPIRING";

export type ProposalsOverviewStats = {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  accepted: number;
  declined: number;
  expired: number;
  changeRequested: number;
  expiring: number;
};

const TERMINAL_STATUSES = new Set(["ACCEPTED", "DECLINED", "EXPIRED"]);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isProposalExpiring(
  row: Pick<ProposalListRow, "status" | "validUntil">,
  nowMs: number,
): boolean {
  if (TERMINAL_STATUSES.has(row.status)) return false;
  if (!row.validUntil) return false;
  const until = new Date(row.validUntil).getTime();
  if (!Number.isFinite(until) || until < nowMs) return false;
  return until <= nowMs + SEVEN_DAYS_MS;
}

export function computeProposalsOverview(
  rows: ProposalListRow[],
  nowMs: number,
): ProposalsOverviewStats {
  let draft = 0;
  let sent = 0;
  let viewed = 0;
  let accepted = 0;
  let declined = 0;
  let expired = 0;
  let changeRequested = 0;
  let expiring = 0;
  for (const r of rows) {
    if (r.status === "DRAFT") draft += 1;
    else if (r.status === "SENT") sent += 1;
    else if (r.status === "VIEWED") viewed += 1;
    else if (r.status === "ACCEPTED") accepted += 1;
    else if (r.status === "DECLINED") declined += 1;
    else if (r.status === "EXPIRED") expired += 1;
    else if (r.status === "CHANGE_REQUESTED") changeRequested += 1;
    if (isProposalExpiring(r, nowMs)) expiring += 1;
  }
  return {
    total: rows.length,
    draft,
    sent,
    viewed,
    accepted,
    declined,
    expired,
    changeRequested,
    expiring,
  };
}

export function proposalMatchesOverviewFilter(
  row: ProposalListRow,
  filter: ProposalsOverviewFilter,
  nowMs: number,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "EXPIRING") return isProposalExpiring(row, nowMs);
  return row.status === filter;
}

import type { IssueRow } from "@/lib/api-client";

export const WORK_ORDER_BOARD_COLUMNS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export type WorkOrderBoardStatus = (typeof WORK_ORDER_BOARD_COLUMNS)[number];

/** Bucket rows for the Kanban board; unknown statuses land in OPEN. */
export function groupWorkOrdersByBoardStatus(
  rows: IssueRow[],
): Record<WorkOrderBoardStatus, IssueRow[]> {
  const m: Record<WorkOrderBoardStatus, IssueRow[]> = {
    OPEN: [],
    IN_PROGRESS: [],
    RESOLVED: [],
    CLOSED: [],
  };
  for (const r of rows) {
    const key = WORK_ORDER_BOARD_COLUMNS.includes(r.status as WorkOrderBoardStatus)
      ? (r.status as WorkOrderBoardStatus)
      : "OPEN";
    m[key].push(r);
  }
  return m;
}

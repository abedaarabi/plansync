import { describe, expect, it } from "vitest";
import type { IssueRow } from "@/lib/api-client";
import { computeWorkOrdersOverview, filterWorkOrders } from "./workOrdersOverviewStats";

function wo(partial: Partial<IssueRow> & Pick<IssueRow, "id" | "status">): IssueRow {
  return {
    createdAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  } as IssueRow;
}

/** Local noon Aug 5 2026 — dueToday/overdue use local calendar day. */
const NOW = new Date(2026, 7, 5, 12, 0, 0).getTime();

describe("filterWorkOrders", () => {
  const rows = [
    wo({ id: "1", status: "OPEN", assigneeId: "u1", dueDate: "2026-08-05T15:00:00.000Z" }),
    wo({ id: "2", status: "IN_PROGRESS", assigneeId: "u2", dueDate: "2026-08-01T00:00:00.000Z" }),
    wo({ id: "3", status: "CLOSED", assigneeId: "u1" }),
    wo({ id: "4", status: "OPEN", priority: "HIGH", workOrderType: "PREVENTIVE" }),
  ];

  it("filters ACTIVE / MINE / OVERDUE / DUE_TODAY", () => {
    expect(filterWorkOrders(rows, "ACTIVE", NOW, "u1").map((r) => r.id)).toEqual(["1", "2", "4"]);
    expect(filterWorkOrders(rows, "MINE", NOW, "u1").map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterWorkOrders(rows, "OVERDUE", NOW, "u1").map((r) => r.id)).toEqual(["2"]);
    expect(filterWorkOrders(rows, "DUE_TODAY", NOW, "u1").map((r) => r.id)).toEqual(["1"]);
  });

  it("filters by priority and type keys", () => {
    expect(filterWorkOrders(rows, "PRI:HIGH", NOW).map((r) => r.id)).toEqual(["4"]);
    expect(filterWorkOrders(rows, "TYPE:PREVENTIVE", NOW).map((r) => r.id)).toEqual(["4"]);
  });
});

describe("computeWorkOrdersOverview", () => {
  it("aggregates KPIs used by My day strip", () => {
    const rows = [
      wo({ id: "1", status: "OPEN", assigneeId: "me", dueDate: "2026-08-05T18:00:00.000Z" }),
      wo({ id: "2", status: "IN_PROGRESS", dueDate: "2026-08-01T00:00:00.000Z" }),
      wo({ id: "3", status: "CLOSED", assigneeId: "me" }),
      wo({ id: "4", status: "OPEN", priority: "LOW", workOrderType: "CORRECTIVE" }),
    ];
    const stats = computeWorkOrdersOverview(rows, NOW, "me");
    expect(stats.total).toBe(4);
    expect(stats.active).toBe(3);
    expect(stats.open).toBe(2);
    expect(stats.inProgress).toBe(1);
    expect(stats.mine).toBe(2);
    expect(stats.dueToday).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.unassigned).toBe(2);
    expect(stats.typeSegments.some((s) => s.key === "TYPE:CORRECTIVE")).toBe(true);
  });
});

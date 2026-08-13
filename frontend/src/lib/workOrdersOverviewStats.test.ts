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

  it("filters aging / building / assignee / completed week", () => {
    const agingRows = [
      wo({
        id: "a",
        status: "OPEN",
        createdAt: "2026-08-04T00:00:00.000Z",
        buildingId: "b1",
        buildingName: "Tower A",
        assigneeId: "u1",
        assignee: { id: "u1", name: "Alex", email: "a@x.com" },
      }),
      wo({
        id: "b",
        status: "OPEN",
        createdAt: "2026-07-01T00:00:00.000Z",
        buildingId: null,
        assigneeId: null,
      }),
      wo({
        id: "c",
        status: "RESOLVED",
        resolvedAt: "2026-08-04T12:00:00.000Z",
      }),
    ];
    expect(filterWorkOrders(agingRows, "AGE:0-3", NOW).map((r) => r.id)).toEqual(["a"]);
    expect(filterWorkOrders(agingRows, "AGE:14+", NOW).map((r) => r.id)).toEqual(["b"]);
    expect(filterWorkOrders(agingRows, "BUILDING:b1", NOW).map((r) => r.id)).toEqual(["a"]);
    expect(filterWorkOrders(agingRows, "BUILDING:__none__", NOW).map((r) => r.id)).toEqual([
      "b",
      "c",
    ]);
    expect(filterWorkOrders(agingRows, "ASSIGNEE:u1", NOW).map((r) => r.id)).toEqual(["a"]);
    expect(filterWorkOrders(agingRows, "ASSIGNEE:__none__", NOW).map((r) => r.id)).toEqual(["b"]);
    expect(filterWorkOrders(agingRows, "COMPLETED_WEEK", NOW).map((r) => r.id)).toEqual(["c"]);
  });
});

describe("computeWorkOrdersOverview", () => {
  it("aggregates KPIs and insight segments", () => {
    const rows = [
      wo({
        id: "1",
        status: "OPEN",
        assigneeId: "me",
        dueDate: "2026-08-05T18:00:00.000Z",
        buildingId: "b1",
        buildingName: "Tower A",
        assignee: { id: "me", name: "Me", email: "me@x.com" },
      }),
      wo({ id: "2", status: "IN_PROGRESS", dueDate: "2026-08-01T00:00:00.000Z" }),
      wo({
        id: "3",
        status: "CLOSED",
        assigneeId: "me",
        resolvedAt: "2026-08-03T00:00:00.000Z",
      }),
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
    expect(stats.completedThisWeek).toBe(1);
    expect(stats.slaBreached).toBeGreaterThanOrEqual(1);
    expect(stats.typeSegments.some((s) => s.key === "TYPE:CORRECTIVE")).toBe(true);
    expect(stats.agingSegments.length).toBeGreaterThan(0);
    expect(stats.buildingSegments.some((s) => s.key === "BUILDING:b1")).toBe(true);
    expect(stats.assigneeSegments.some((s) => s.key === "ASSIGNEE:me")).toBe(true);
  });
});

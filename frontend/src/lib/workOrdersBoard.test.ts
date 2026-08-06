import { describe, expect, it } from "vitest";
import type { IssueRow } from "@/lib/api-client";
import { groupWorkOrdersByBoardStatus } from "./workOrdersBoard";

function wo(id: string, status: string): IssueRow {
  return { id, status, createdAt: "2026-08-01T00:00:00.000Z" } as IssueRow;
}

describe("groupWorkOrdersByBoardStatus", () => {
  it("buckets by status and maps unknown to OPEN", () => {
    const grouped = groupWorkOrdersByBoardStatus([
      wo("1", "OPEN"),
      wo("2", "IN_PROGRESS"),
      wo("3", "RESOLVED"),
      wo("4", "CLOSED"),
      wo("5", "WEIRD"),
    ]);
    expect(grouped.OPEN.map((r) => r.id)).toEqual(["1", "5"]);
    expect(grouped.IN_PROGRESS.map((r) => r.id)).toEqual(["2"]);
    expect(grouped.RESOLVED.map((r) => r.id)).toEqual(["3"]);
    expect(grouped.CLOSED.map((r) => r.id)).toEqual(["4"]);
  });
});

import { describe, expect, it } from "vitest";
import type { IssueRow } from "@/lib/api-client";
import { formatWorkOrderNumber, workOrderSlaInfo } from "./workOrderSla";

function wo(partial: Partial<IssueRow> & Pick<IssueRow, "id" | "status" | "createdAt">): IssueRow {
  return partial as IssueRow;
}

describe("formatWorkOrderNumber", () => {
  it("prefers workOrderNumber padded as WO-NNN", () => {
    expect(
      formatWorkOrderNumber(
        wo({ id: "abc12345", status: "OPEN", createdAt: "", workOrderNumber: 7 }),
      ),
    ).toBe("WO-007");
  });

  it("falls back to displayNumber then id slice", () => {
    expect(
      formatWorkOrderNumber(
        wo({ id: "abcdef12", status: "OPEN", createdAt: "", displayNumber: 12 }),
      ),
    ).toBe("WO-012");
    expect(formatWorkOrderNumber(wo({ id: "zz99xx", status: "OPEN", createdAt: "" }))).toBe(
      "#zz99xx",
    );
  });
});

describe("workOrderSlaInfo", () => {
  const now = Date.parse("2026-08-05T12:00:00.000Z");

  it("returns null for closed work orders", () => {
    expect(
      workOrderSlaInfo(
        wo({
          id: "1",
          status: "CLOSED",
          createdAt: "2026-08-01T12:00:00.000Z",
          priority: "HIGH",
        }),
        now,
      ),
    ).toBeNull();
  });

  it("marks past due as SLA breach", () => {
    const info = workOrderSlaInfo(
      wo({
        id: "1",
        status: "OPEN",
        createdAt: "2026-08-05T10:00:00.000Z",
        dueDate: "2026-08-04T00:00:00.000Z",
        priority: "MEDIUM",
      }),
      now,
    );
    expect(info?.tone).toBe("danger");
    expect(info?.label).toContain("Past due");
  });

  it("marks critical open past resolve window as breach", () => {
    const info = workOrderSlaInfo(
      wo({
        id: "1",
        status: "IN_PROGRESS",
        createdAt: "2026-08-01T12:00:00.000Z",
        statusChangedAt: "2026-08-01T12:00:00.000Z",
        priority: "CRITICAL",
      }),
      now,
    );
    expect(info?.tone).toBe("danger");
    expect(info?.label).toContain("SLA breach");
  });

  it("marks respond-window breach as at risk", () => {
    // MEDIUM respond = 24h; open 30h → at risk before resolve (120h)
    const info = workOrderSlaInfo(
      wo({
        id: "1",
        status: "OPEN",
        createdAt: "2026-08-04T06:00:00.000Z",
        statusChangedAt: "2026-08-04T06:00:00.000Z",
        priority: "MEDIUM",
      }),
      now,
    );
    expect(info?.tone).toBe("warn");
    expect(info?.label).toContain("SLA at risk");
  });

  it("returns ok when within respond window", () => {
    const info = workOrderSlaInfo(
      wo({
        id: "1",
        status: "OPEN",
        createdAt: "2026-08-05T10:00:00.000Z",
        statusChangedAt: "2026-08-05T10:00:00.000Z",
        priority: "HIGH",
      }),
      now,
    );
    expect(info?.tone).toBe("ok");
    expect(info?.label).toMatch(/^Open \d+h$/);
  });
});

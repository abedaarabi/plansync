import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  inspectionFrequencyToIntervalDays,
  validateFailEvidence,
} from "./omInspectionSchedule.js";

describe("inspectionFrequencyToIntervalDays", () => {
  it("maps standard labels", () => {
    expect(inspectionFrequencyToIntervalDays("Daily")).toBe(1);
    expect(inspectionFrequencyToIntervalDays("weekly")).toBe(7);
    expect(inspectionFrequencyToIntervalDays("Bi-weekly")).toBe(14);
    expect(inspectionFrequencyToIntervalDays("Monthly")).toBe(30);
    expect(inspectionFrequencyToIntervalDays("Quarterly")).toBe(90);
    expect(inspectionFrequencyToIntervalDays("Bi-annual")).toBe(182);
    expect(inspectionFrequencyToIntervalDays("Annual")).toBe(365);
    expect(inspectionFrequencyToIntervalDays("Yearly")).toBe(365);
  });

  it("returns null for empty or unknown", () => {
    expect(inspectionFrequencyToIntervalDays(null)).toBeNull();
    expect(inspectionFrequencyToIntervalDays("")).toBeNull();
    expect(inspectionFrequencyToIntervalDays("  ")).toBeNull();
    expect(inspectionFrequencyToIntervalDays("Custom")).toBeNull();
  });
});

describe("addUtcDays", () => {
  it("adds days in UTC without mutating the input", () => {
    const from = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
    const next = addUtcDays(from, 30);
    expect(from.toISOString()).toBe("2026-01-01T12:00:00.000Z");
    expect(next.toISOString()).toBe("2026-01-31T12:00:00.000Z");
  });
});

describe("validateFailEvidence", () => {
  const checklist = [
    { id: "a", label: "Extinguisher", type: "passfail" },
    { id: "b", label: "Notes", type: "text" },
  ];

  it("skips when requireFailEvidence is off", () => {
    expect(
      validateFailEvidence({
        requireFailEvidence: false,
        checklist,
        results: [{ itemId: "a", outcome: "fail" }],
      }),
    ).toEqual([]);
  });

  it("ignores text items and pass outcomes", () => {
    expect(
      validateFailEvidence({
        requireFailEvidence: true,
        checklist,
        results: [
          { itemId: "a", outcome: "pass" },
          { itemId: "b", outcome: "na", note: "" },
        ],
      }),
    ).toEqual([]);
  });

  it("requires photo and note for fail items", () => {
    const issues = validateFailEvidence({
      requireFailEvidence: true,
      checklist,
      results: [{ itemId: "a", outcome: "fail", note: "  ", photoDataUrl: "http://x" }],
    });
    expect(issues).toEqual([{ itemId: "a", label: "Extinguisher", missing: ["photo", "note"] }]);
  });

  it("accepts complete fail evidence", () => {
    expect(
      validateFailEvidence({
        requireFailEvidence: true,
        checklist,
        results: [
          {
            itemId: "a",
            outcome: "fail",
            note: "Damaged",
            photoDataUrl: "data:image/jpeg;base64,abc",
          },
        ],
      }),
    ).toEqual([]);
  });
});

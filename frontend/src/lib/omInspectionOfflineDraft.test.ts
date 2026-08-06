/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearOmInspectionOfflineDraft,
  listOmInspectionOfflineDrafts,
  loadOmInspectionOfflineDraft,
  saveOmInspectionOfflineDraft,
} from "./omInspectionOfflineDraft";

describe("omInspectionOfflineDraft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves, loads, lists, and clears drafts for a project", () => {
    saveOmInspectionOfflineDraft("proj-1", "run-a", [{ itemId: "1", outcome: "pass" }]);
    saveOmInspectionOfflineDraft("proj-1", "run-b", [{ itemId: "2", outcome: "fail" }]);
    saveOmInspectionOfflineDraft("proj-2", "run-c", [{ itemId: "3", outcome: "na" }]);

    const loaded = loadOmInspectionOfflineDraft("proj-1", "run-a");
    expect(loaded?.projectId).toBe("proj-1");
    expect(loaded?.runId).toBe("run-a");
    expect(loaded?.resultJson).toEqual([{ itemId: "1", outcome: "pass" }]);
    expect(typeof loaded?.savedAt).toBe("string");

    expect(listOmInspectionOfflineDrafts("proj-1")).toHaveLength(2);
    expect(listOmInspectionOfflineDrafts("proj-2")).toHaveLength(1);

    clearOmInspectionOfflineDraft("proj-1", "run-a");
    expect(loadOmInspectionOfflineDraft("proj-1", "run-a")).toBeNull();
    expect(listOmInspectionOfflineDrafts("proj-1")).toHaveLength(1);
  });

  it("rejects malformed stored JSON", () => {
    localStorage.setItem(
      "plansync:om-insp-draft:proj-1:run-x",
      JSON.stringify({ projectId: "proj-1", runId: "run-x", resultJson: "nope" }),
    );
    expect(loadOmInspectionOfflineDraft("proj-1", "run-x")).toBeNull();
  });
});

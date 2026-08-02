import { describe, expect, it } from "vitest";
import {
  assignClashGroups,
  canonicalizeElementPair,
  CLASH_MATERIALITY_MM,
  isNoLongerClashing,
  pairKey,
  shouldReopenDismissed,
} from "./clashPersistence.js";

describe("clashPersistence helpers", () => {
  it("canonically orders element pairs", () => {
    const a = { elementId: "bbb", guid: "gB", fileVersionId: "fvB" };
    const b = { elementId: "aaa", guid: "gA", fileVersionId: "fvA" };
    const pair = canonicalizeElementPair(a, b);
    expect(pair.elementAId).toBe("aaa");
    expect(pair.elementBId).toBe("bbb");
    expect(pair.guidA).toBe("gA");
    expect(pairKey(pair.elementAId, pair.elementBId)).toBe("aaa|bbb");
  });

  it("preserves dismissed status when distance is stable", () => {
    expect(shouldReopenDismissed("IGNORED", -12, -11)).toBe(false);
    expect(shouldReopenDismissed("RESOLVED", 5, 5)).toBe(false);
  });

  it("reopens dismissed when distance moves beyond materiality", () => {
    expect(shouldReopenDismissed("IGNORED", 0, CLASH_MATERIALITY_MM + 1)).toBe(true);
    expect(shouldReopenDismissed("RESOLVED", -10, 10)).toBe(true);
  });

  it("does not reopen NEW/ACTIVE", () => {
    expect(shouldReopenDismissed("NEW", 0, 100)).toBe(false);
    expect(shouldReopenDismissed("ACTIVE", null, 100)).toBe(false);
  });

  it("derives no-longer-clashing from lastSeen vs lastRun", () => {
    const runAt = new Date("2026-08-01T12:00:00Z");
    expect(isNoLongerClashing(new Date("2026-08-01T11:00:00Z"), runAt)).toBe(true);
    expect(isNoLongerClashing(new Date("2026-08-01T12:00:00Z"), runAt)).toBe(false);
    expect(isNoLongerClashing(runAt, null)).toBe(false);
  });

  it("clusters nearby points into stable groups", () => {
    const groups = assignClashGroups(
      [
        { id: "1", point: { x: 0, y: 0, z: 0 }, groupId: "keep-me" },
        { id: "2", point: { x: 0.5, y: 0, z: 0 }, groupId: null },
        { id: "3", point: { x: 20, y: 0, z: 0 }, groupId: null },
      ],
      1.5,
    );
    expect(groups.get("1")).toBe("keep-me");
    expect(groups.get("2")).toBe("keep-me");
    expect(groups.get("3")).not.toBe("keep-me");
  });
});

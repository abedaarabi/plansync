import { beforeEach, describe, expect, it } from "vitest";
import {
  LAST_PROJECT_CONTEXT_KEY,
  markSkipProjectRestore,
  shouldSkipProjectRestore,
} from "@/lib/lastProject";
import { resolveRestoreOnEntry } from "@/lib/projectRestoreLogic";

describe("resolveRestoreOnEntry", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("does not clear skip flag so Strict Mode remounts stay on the hub", () => {
    markSkipProjectRestore();
    expect(shouldSkipProjectRestore()).toBe(true);

    const first = resolveRestoreOnEntry(true, false, "ws-1", "/projects");
    expect(first).toEqual({ phase: "show" });
    expect(shouldSkipProjectRestore()).toBe(true);

    const remount = resolveRestoreOnEntry(true, false, "ws-1", "/projects");
    expect(remount).toEqual({ phase: "show" });
    expect(shouldSkipProjectRestore()).toBe(true);
  });

  it("restores last project when skip is not set", () => {
    localStorage.setItem(
      LAST_PROJECT_CONTEXT_KEY,
      JSON.stringify({
        "ws-1": {
          projectId: "proj-1",
          path: "/projects/proj-1/home",
          updatedAt: Date.now(),
        },
      }),
    );

    const result = resolveRestoreOnEntry(true, false, "ws-1", "/projects");
    expect(result).toEqual({
      phase: "redirecting",
      target: "/projects/proj-1/home",
    });
  });

  it("waits while workspace context is loading", () => {
    expect(resolveRestoreOnEntry(true, true, undefined, "/projects")).toBeNull();
  });
});

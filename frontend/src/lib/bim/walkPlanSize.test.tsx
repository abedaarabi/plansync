import { beforeEach, describe, expect, it } from "vitest";
import { defaultWalkPlanSize, readSavedWalkPlanSize, writeSavedWalkPlanSize } from "./walkPlanSize";

const STORAGE_KEY = "plansync-bim-walk-plan-size";

describe("walk plan size persistence", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to mini", () => {
    expect(defaultWalkPlanSize()).toBe("mini");
    expect(readSavedWalkPlanSize()).toBe("mini");
  });

  it("round-trips saved size", () => {
    writeSavedWalkPlanSize("big");
    expect(readSavedWalkPlanSize()).toBe("big");
    writeSavedWalkPlanSize("off");
    expect(readSavedWalkPlanSize()).toBe("off");
  });

  it("falls back on invalid storage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ size: "huge" }));
    expect(readSavedWalkPlanSize()).toBe("mini");
  });
});

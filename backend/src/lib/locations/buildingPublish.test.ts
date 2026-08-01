import { describe, expect, it } from "vitest";
import { deriveBuildingPublishStatus } from "./buildingPublish.js";

describe("deriveBuildingPublishStatus", () => {
  it("is setup without IFC or levels", () => {
    expect(
      deriveBuildingPublishStatus({
        ifcReady: false,
        levelCount: 0,
        mappingsPublishedAt: null,
        mappingsDirty: true,
      }),
    ).toBe("setup");
    expect(
      deriveBuildingPublishStatus({
        ifcReady: true,
        levelCount: 0,
        mappingsPublishedAt: null,
        mappingsDirty: true,
      }),
    ).toBe("setup");
  });

  it("is setup until published", () => {
    expect(
      deriveBuildingPublishStatus({
        ifcReady: true,
        levelCount: 3,
        mappingsPublishedAt: null,
        mappingsDirty: true,
      }),
    ).toBe("setup");
  });

  it("is ready when published and clean", () => {
    expect(
      deriveBuildingPublishStatus({
        ifcReady: true,
        levelCount: 3,
        mappingsPublishedAt: new Date(),
        mappingsDirty: false,
      }),
    ).toBe("ready");
  });

  it("is needs_update when dirty after publish", () => {
    expect(
      deriveBuildingPublishStatus({
        ifcReady: true,
        levelCount: 3,
        mappingsPublishedAt: new Date(),
        mappingsDirty: true,
      }),
    ).toBe("needs_update");
  });
});

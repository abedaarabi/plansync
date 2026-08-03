import { describe, expect, it } from "vitest";
import { BIM_CAMERA_NAVIGATION_PROFILES, getBimCameraNavigationProfile } from "./cameraNavigation";

describe("camera navigation profiles", () => {
  it("defaults to normal when speed is unknown", () => {
    expect(getBimCameraNavigationProfile()).toEqual(BIM_CAMERA_NAVIGATION_PROFILES.normal);
  });

  it("orders presets from slowest to fastest orbit response", () => {
    const slow = BIM_CAMERA_NAVIGATION_PROFILES.slow;
    const normal = BIM_CAMERA_NAVIGATION_PROFILES.normal;
    const fast = BIM_CAMERA_NAVIGATION_PROFILES.fast;

    expect(slow.smoothTime).toBeGreaterThan(normal.smoothTime);
    expect(normal.smoothTime).toBeGreaterThan(fast.smoothTime);
    expect(slow.azimuthRotateSpeed).toBeLessThan(normal.azimuthRotateSpeed);
    expect(normal.azimuthRotateSpeed).toBeLessThan(fast.azimuthRotateSpeed);
    expect(slow.dollySpeed).toBeLessThan(normal.dollySpeed);
    expect(normal.dollySpeed).toBeLessThan(fast.dollySpeed);
    expect(slow.truckSpeed).toBeLessThan(normal.truckSpeed);
    expect(normal.truckSpeed).toBeLessThan(fast.truckSpeed);
  });
});

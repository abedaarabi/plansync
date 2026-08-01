import { describe, expect, it } from "vitest";
import {
  BimAdaptiveQualityController,
  bimQualityPixelRatio,
  resolveInitialBimQuality,
  type BimGpuProfile,
} from "./renderQuality";

const desktop: BimGpuProfile = {
  deviceMemoryGb: 16,
  coarsePointer: false,
  maxSamples: 8,
  maxTextureSize: 16384,
  modelCount: 1,
};

describe("BIM render quality", () => {
  it("selects a high desktop profile in automatic mode", () => {
    expect(resolveInitialBimQuality("auto", desktop).effective).toBe("high");
  });

  it("balances constrained and coarse-pointer devices", () => {
    expect(
      resolveInitialBimQuality("auto", {
        ...desktop,
        deviceMemoryGb: 4,
        coarsePointer: true,
      }).effective,
    ).toBe("medium");
  });

  it("honors explicit presets", () => {
    expect(resolveInitialBimQuality("ultra", { ...desktop, maxSamples: 0 }).effective).toBe(
      "ultra",
    );
  });

  it("steps down after sustained slow interaction and restores at rest", () => {
    const controller = new BimAdaptiveQualityController("auto", desktop);
    let changed = null;
    for (let i = 0; i < 8; i++) changed = controller.observeInteractionFrame(30);
    expect(changed?.effective).toBe("medium");
    expect(changed?.interactionReduced).toBe(true);
    expect(controller.restoreAfterInteraction()?.effective).toBe("high");
  });

  it("caps device pixel ratio per effective quality", () => {
    expect(bimQualityPixelRatio("low", 3)).toBe(1);
    expect(bimQualityPixelRatio("medium", 3)).toBe(1.35);
    expect(bimQualityPixelRatio("ultra", 3)).toBe(2);
  });
});

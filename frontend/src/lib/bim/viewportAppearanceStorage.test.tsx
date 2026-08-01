import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BIM_VIEWPORT_APPEARANCE, type BimViewportAppearance } from "./viewportAppearance";
import {
  readSavedViewportAppearance,
  writeSavedViewportAppearance,
} from "./viewportAppearanceStorage";

const STORAGE_KEY = "plansync-bim-viewport-appearance";

describe("viewport appearance persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the professional rendering settings", () => {
    const appearance: BimViewportAppearance = {
      ...DEFAULT_BIM_VIEWPORT_APPEARANCE,
      backgroundTheme: "professional_light",
      qualityPreset: "high",
      edgeMode: "engineering",
      gridSpacing: "coarse",
      gridAxes: true,
      ssaoEnabled: false,
      navigationSpeed: "slow",
    };
    writeSavedViewportAppearance(appearance);
    expect(readSavedViewportAppearance()).toEqual(appearance);
  });

  it("migrates valid version 4 preferences into the new defaults", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 4,
        appearance: {
          environment: "overcast",
          colorMode: "monochrome",
          spaceDisplay: "hidden",
          fogMode: "light",
          gridMode: "fade_far",
        },
      }),
    );

    expect(readSavedViewportAppearance()).toMatchObject({
      environment: "overcast",
      colorMode: "monochrome",
      spaceDisplay: "hidden",
      backgroundTheme: "professional_dark",
      qualityPreset: "auto",
      ssaoEnabled: true,
    });
  });

  it("rejects invalid persisted option ids", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 5, appearance: { edgeMode: "neon", qualityPreset: "maximum" } }),
    );
    expect(readSavedViewportAppearance()).toEqual(DEFAULT_BIM_VIEWPORT_APPEARANCE);
  });
});

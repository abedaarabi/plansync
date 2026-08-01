import { describe, expect, it } from "vitest";
import { resolveElementColor } from "./materialColor";
import { getBimBackgroundProfile } from "./renderingProfile";

describe("professional BIM materials", () => {
  it("uses restrained discipline colors and physically plausible surface parameters", () => {
    const concrete = resolveElementColor("IfcSlab", undefined);
    const steel = resolveElementColor("IfcBeam", undefined);
    const hvac = resolveElementColor("IfcDuctSegment", undefined);
    const glass = resolveElementColor("IfcWindow", undefined);

    expect(concrete.pbr.surfaceKind).toBe("concrete");
    expect(concrete.pbr.roughness).toBeGreaterThan(0.75);
    expect(steel.pbr.metalness).toBeGreaterThanOrEqual(0.5);
    expect(hvac.color.getHSL({ h: 0, s: 0, l: 0 }).s).toBeLessThan(0.5);
    expect(glass.transparent).toBe(true);
    expect(glass.depthWrite).toBe(false);
    expect(glass.opacity).toBeLessThanOrEqual(0.24);
  });

  it("defines distinct professional backgrounds", () => {
    const dark = getBimBackgroundProfile("professional_dark");
    const light = getBimBackgroundProfile("professional_light");
    const white = getBimBackgroundProfile("white");

    expect(dark.top).not.toBe(light.top);
    expect(light.top).not.toBe(white.top);
  });
});

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clampWalkEyePosition,
  detectModelUnitsFromRadius,
  findWalkFloorY,
  isValidBox3,
  resolveStoreyName,
  walkEyeHeight,
  walkFeetInset,
} from "./walkMath";

function box(min: [number, number, number], max: [number, number, number]): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
}

describe("detectModelUnitsFromRadius", () => {
  it("defaults to metres for missing/invalid radius", () => {
    expect(detectModelUnitsFromRadius(null)).toBe("m");
    expect(detectModelUnitsFromRadius(undefined)).toBe("m");
    expect(detectModelUnitsFromRadius(Number.NaN)).toBe("m");
  });

  it("uses mm when radius is large", () => {
    expect(detectModelUnitsFromRadius(500)).toBe("m");
    expect(detectModelUnitsFromRadius(501)).toBe("mm");
  });
});

describe("isValidBox3", () => {
  it("rejects empty, inverted, or non-finite boxes", () => {
    expect(isValidBox3(null)).toBe(false);
    expect(isValidBox3(new THREE.Box3())).toBe(false);
    expect(isValidBox3(box([2, 0, 0], [1, 1, 1]))).toBe(false);
    expect(isValidBox3(box([Number.NaN, 0, 0], [1, 1, 1]))).toBe(false);
  });

  it("accepts a finite non-empty box", () => {
    expect(isValidBox3(box([0, 0, 0], [10, 3, 8]))).toBe(true);
  });
});

describe("walkEyeHeight", () => {
  it("falls back to standing height for invalid boxes", () => {
    expect(walkEyeHeight(new THREE.Box3(), "m")).toBe(1.7);
    expect(walkEyeHeight(new THREE.Box3(), "mm")).toBe(1700);
  });

  it("clamps relative height by model units", () => {
    // 5% of 40m = 2.0 → within [1.4, 2.1]
    expect(walkEyeHeight(box([0, 0, 0], [10, 40, 10]), "m")).toBeCloseTo(2.0);
    // 5% of 10m = 0.5 → clamp to 1.4
    expect(walkEyeHeight(box([0, 0, 0], [10, 10, 10]), "m")).toBe(1.4);
    // 5% of 40000mm = 2000 → within [1400, 2100]
    expect(walkEyeHeight(box([0, 0, 0], [10000, 40000, 10000]), "mm")).toBe(2000);
  });
});

describe("walkFeetInset", () => {
  it("uses unit-aware minimum inset", () => {
    expect(walkFeetInset(new THREE.Box3(), "m")).toBe(0.25);
    expect(walkFeetInset(new THREE.Box3(), "mm")).toBe(250);
  });

  it("grows with footprint span when larger than the minimum", () => {
    // min(x,z) = 50 → 2% = 1.0 > 0.25
    expect(walkFeetInset(box([0, 0, 0], [50, 3, 80]), "m")).toBe(1);
  });
});

describe("findWalkFloorY", () => {
  it("prefers storey floor, then hint, then model min y", () => {
    const model = box([0, 5, 0], [10, 8, 10]);
    expect(findWalkFloorY(2, model, 12)).toBe(12);
    expect(findWalkFloorY(2, model, null)).toBe(2);
    expect(findWalkFloorY(Number.NaN, model, null)).toBe(5);
    expect(findWalkFloorY(Number.NaN, null, null)).toBe(0);
  });
});

describe("clampWalkEyePosition", () => {
  it("places the eye above the storey floor inside the footprint", () => {
    const model = box([0, 0, 0], [20, 4, 20]);
    const eye = clampWalkEyePosition({
      pivot: new THREE.Vector3(100, 1, 100),
      modelBox: model,
      eyeHeight: 1.7,
      units: "m",
      storeyFloorY: 2,
    });
    // inset = max(20*0.02, 0.25) = 0.4 → clamp into [0.4, 19.6]
    expect(eye.x).toBe(19.6);
    expect(eye.z).toBe(19.6);
    expect(eye.y).toBeCloseTo(3.7);
  });

  it("keeps an in-bounds pivot and uses model floor when storey is unset", () => {
    const model = box([0, 1, 0], [10, 4, 10]);
    const eye = clampWalkEyePosition({
      pivot: new THREE.Vector3(5, 1, 5),
      modelBox: model,
      eyeHeight: 1.6,
      units: "m",
      storeyFloorY: null,
    });
    expect(eye.x).toBe(5);
    expect(eye.z).toBe(5);
    expect(eye.y).toBeCloseTo(2.6);
  });
});

describe("resolveStoreyName", () => {
  const keys = ["Level 01", "Roof", "B1 Parking"];

  it("returns null for empty input", () => {
    expect(resolveStoreyName(null, keys)).toBeNull();
    expect(resolveStoreyName("", keys)).toBeNull();
  });

  it("matches exact, case-insensitive, then substring aliases", () => {
    expect(resolveStoreyName("Level 01", keys)).toBe("Level 01");
    expect(resolveStoreyName("level 01", keys)).toBe("Level 01");
    expect(resolveStoreyName("Parking", keys)).toBe("B1 Parking");
    expect(resolveStoreyName("Unknown", keys)).toBeNull();
  });
});

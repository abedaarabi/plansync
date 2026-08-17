import { describe, expect, it } from "vitest";
import {
  formatPlacement,
  placementsDiffer,
  readElementPlacement,
  roundPlacement,
} from "./elementPlacement.js";

describe("roundPlacement", () => {
  it("rounds metre-scale coords to millimetres", () => {
    expect(roundPlacement({ x: 1.23456, y: 2, z: 0 })).toEqual({ x: 1.235, y: 2, z: 0 });
  });

  it("rounds millimetre-scale coords to whole millimetres", () => {
    expect(roundPlacement({ x: 1200.4, y: 50.2, z: 0 })).toEqual({ x: 1200, y: 50, z: 0 });
  });
});

describe("placementsDiffer", () => {
  it("ignores a missing side so legacy indexes do not mass-modify", () => {
    expect(placementsDiffer({ x: 1, y: 2, z: 3 }, null)).toBe(false);
    expect(placementsDiffer(undefined, { x: 1, y: 2, z: 3 })).toBe(false);
  });

  it("detects a move", () => {
    expect(placementsDiffer({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(true);
  });
});

describe("readElementPlacement", () => {
  it("walks IfcLocalPlacement to a cartesian origin", () => {
    const lines: Record<number, unknown> = {
      10: { ObjectPlacement: { value: 20 } },
      20: { PlacementRelTo: { value: 30 }, RelativePlacement: { value: 21 } },
      21: { Location: { value: 22 } },
      22: { Coordinates: [{ value: 1 }, { value: 0 }, { value: 0 }] },
      30: { RelativePlacement: { value: 31 } },
      31: { Location: { value: 32 } },
      32: { Coordinates: [{ value: 10 }, { value: 2 }, { value: 0 }] },
    };
    const api = { GetLine: (_m: number, id: number) => lines[id] };
    expect(readElementPlacement(api, 0, 10)).toEqual({ x: 11, y: 2, z: 0 });
  });
});

describe("formatPlacement", () => {
  it("renders a rounded triple", () => {
    expect(formatPlacement({ x: 1.23456, y: 0, z: 0 })).toBe("1.235, 0, 0");
  });
});

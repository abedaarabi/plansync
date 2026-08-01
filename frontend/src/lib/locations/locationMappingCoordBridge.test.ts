import { describe, expect, it } from "vitest";
import type { CalibrationInput } from "@/lib/api-client/locations";
import { buildCoordTransformFromLocationCalibration } from "./locationMappingCoordBridge";

describe("buildCoordTransformFromLocationCalibration", () => {
  it("maps pdf picks through plan norm to world coordinates", () => {
    const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 10 };
    const calibration: CalibrationInput = {
      pointPairs: [
        { pdf: { x: 0.1, y: 0.1 }, plan: { x: 0.2, y: 0.2 } },
        { pdf: { x: 0.9, y: 0.1 }, plan: { x: 0.8, y: 0.2 } },
      ],
    };

    const transform = buildCoordTransformFromLocationCalibration(
      calibration,
      bounds,
      1000,
      500,
      512,
    );

    expect(transform.version).toBe(1);
    expect(transform.controlPoints).toHaveLength(2);
    expect(transform.scale).toBeGreaterThan(0);
  });
});

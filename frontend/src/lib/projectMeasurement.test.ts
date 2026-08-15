import { describe, expect, it } from "vitest";
import {
  defaultMeasureUnitForProject,
  defaultTakeoffUnitForKind,
  formatRawGeometryForProject,
  formatSiQuantityForProject,
  normalizeProjectMeasurementSystem,
  projectDisplayUnits,
  siQuantityToDisplay,
} from "./projectMeasurement";

describe("project measurement display", () => {
  it("normalizes unknown systems to metric", () => {
    expect(normalizeProjectMeasurementSystem("IMPERIAL")).toBe("IMPERIAL");
    expect(normalizeProjectMeasurementSystem("METRIC")).toBe("METRIC");
    expect(normalizeProjectMeasurementSystem("feet")).toBe("METRIC");
    expect(normalizeProjectMeasurementSystem(null)).toBe("METRIC");
  });

  it("selects metric and imperial display units", () => {
    expect(defaultMeasureUnitForProject("METRIC")).toBe("mm");
    expect(defaultMeasureUnitForProject("IMPERIAL")).toBe("ft");
    expect(defaultTakeoffUnitForKind("area", "METRIC")).toBe("m²");
    expect(defaultTakeoffUnitForKind("area", "IMPERIAL")).toBe("ft²");
    expect(projectDisplayUnits("IMPERIAL")).toEqual({
      length: "ft",
      area: "ft²",
      volume: "ft³",
    });
  });

  it("converts SI BIM quantities only for imperial display", () => {
    expect(siQuantityToDisplay(1, "length", "METRIC")).toBe(1);
    expect(siQuantityToDisplay(1, "length", "IMPERIAL")).toBeCloseTo(3.28084);
    expect(siQuantityToDisplay(1, "area", "IMPERIAL")).toBeCloseTo(10.76391);
    expect(siQuantityToDisplay(1, "volume", "IMPERIAL")).toBeCloseTo(35.31467);
    expect(formatSiQuantityForProject(1, "area", "IMPERIAL")).toBe("10.76 ft²");
  });

  it("formats stored takeoff geometry in project display units", () => {
    expect(formatRawGeometryForProject("linear", 304.8, "IMPERIAL")).toBe("1.000 ft");
    expect(formatRawGeometryForProject("area", 92_903.04, "IMPERIAL")).toBe("1.000 ft²");
    expect(formatRawGeometryForProject("count", 2.6, "METRIC")).toBe("3 marks");
  });
});

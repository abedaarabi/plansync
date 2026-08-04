import { describe, expect, it } from "vitest";
import { configureLiteFallbackImporter, configureLod500Importer } from "./ifcImporterProfiles";

function fakeImporter() {
  return {
    geometryProcessSettings: {} as Record<string, unknown>,
    doubleSidedMaterials: true,
  };
}

describe("ifcImporterProfiles", () => {
  it("configures full LOD500 settings", () => {
    const importer = fakeImporter();
    configureLod500Importer(importer as never);
    expect(importer.geometryProcessSettings.threshold).toBe(10_000);
    expect(importer.geometryProcessSettings.processIfcRelSpaceBoundarySecondLevel).toBe(true);
    expect(importer.doubleSidedMaterials).toBe(true);
  });

  it("configures a lighter emergency fallback profile", () => {
    const importer = fakeImporter();
    configureLiteFallbackImporter(importer as never);
    expect(importer.geometryProcessSettings.threshold).toBe(1_000);
    expect(importer.geometryProcessSettings.processIfcRelSpaceBoundarySecondLevel).toBe(false);
    expect(importer.doubleSidedMaterials).toBe(false);
  });
});

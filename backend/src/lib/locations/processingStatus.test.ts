import { describe, expect, it } from "vitest";
import {
  mapBimStatusToProcessingStatus,
  resolveFileVersionProcessingStatus,
} from "./processingStatus.js";

describe("mapBimStatusToProcessingStatus", () => {
  it("maps BIM pipeline states", () => {
    expect(mapBimStatusToProcessingStatus("pending")).toBe("PENDING");
    expect(mapBimStatusToProcessingStatus("running")).toBe("PROCESSING");
    expect(mapBimStatusToProcessingStatus("summary_ready")).toBe("PROCESSING");
    expect(mapBimStatusToProcessingStatus("ready")).toBe("READY");
    expect(mapBimStatusToProcessingStatus("failed")).toBe("FAILED");
  });
});

describe("resolveFileVersionProcessingStatus", () => {
  it("derives IFC status from bimConversionStatus when assetProcessingStatus is PENDING", () => {
    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "running",
        assetProcessingStatus: "PENDING",
        buildingAssetType: "IFC",
      }),
    ).toBe("PROCESSING");

    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "ready",
        assetProcessingStatus: "PENDING",
        buildingAssetType: "IFC",
      }),
    ).toBe("READY");
  });

  it("uses asset pipeline for PDFs", () => {
    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "pending",
        assetProcessingStatus: "PROCESSING",
        buildingAssetType: "PDF",
      }),
    ).toBe("PROCESSING");

    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "pending",
        assetProcessingStatus: "READY",
        buildingAssetType: "PDF",
      }),
    ).toBe("READY");
  });

  it("uses BIM conversion for IFC even if asset status is stale", () => {
    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "ready",
        assetProcessingStatus: "PROCESSING",
        buildingAssetType: "IFC",
      }),
    ).toBe("READY");

    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "failed",
        assetProcessingStatus: "READY",
        buildingAssetType: "IFC",
      }),
    ).toBe("FAILED");
  });

  it("falls back to PENDING when nothing has started", () => {
    expect(
      resolveFileVersionProcessingStatus({
        bimConversionStatus: "pending",
        assetProcessingStatus: null,
        buildingAssetType: "OTHER",
      }),
    ).toBe("PENDING");
  });
});

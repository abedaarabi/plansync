import { describe, expect, it } from "vitest";
import { jobPhaseFromStatus, mergeJobPhase } from "./bimJobTracker";
import {
  canOpenBimViewer,
  isBimPublishedReady,
  needsBimStatusPolling,
  resolveIfcUiPhase,
} from "./ifcModelStatus";
import type { BimConversionStatus } from "./types";
import type { BimTrackedJob } from "./bimJobTracker";

function status(partial: Partial<BimConversionStatus>): BimConversionStatus {
  return {
    fileVersionId: "fv1",
    conversionStatus: "ready",
    fragmentsReady: false,
    quantityIndexSummaryReady: false,
    quantityIndexReady: false,
    partial: false,
    indexProgress: null,
    indexPhase: null,
    loq: null,
    jobRunId: null,
    bimPublishedAt: null,
    levelCount: 0,
    mappedSheetCount: 0,
    ...partial,
  };
}

describe("jobPhaseFromStatus", () => {
  it("does not stick on converting_geometry when fragments are ready", () => {
    expect(
      jobPhaseFromStatus(
        status({
          fragmentsReady: true,
          quantityIndexReady: false,
          conversionStatus: "running",
        }),
      ),
    ).toBe("ready_to_publish");
  });

  it("maps running without geometry to indexing", () => {
    expect(
      jobPhaseFromStatus(
        status({
          fragmentsReady: false,
          quantityIndexSummaryReady: true,
          conversionStatus: "running",
        }),
      ),
    ).toBe("indexing");
  });
});

describe("resolveIfcUiPhase", () => {
  it("advances past a stale tracked phase", () => {
    const tracked: BimTrackedJob = {
      fileVersionId: "fv1",
      fileId: "f1",
      fileName: "a.ifc",
      projectId: "p",
      workspaceId: "w",
      phase: "indexing",
      uploadPct: 100,
      indexProgress: 50,
      indexPhase: "summary",
      conversionStatus: "running",
      error: null,
      startedAt: 1,
      updatedAt: 1,
    };
    expect(
      resolveIfcUiPhase(status({ fragmentsReady: true, conversionStatus: "running" }), tracked),
    ).toBe("ready_to_publish");
  });

  it("mergeJobPhase prefers further status", () => {
    expect(mergeJobPhase("ready_to_publish", "indexing")).toBe("ready_to_publish");
    expect(mergeJobPhase("indexing", "converting_geometry")).toBe("converting_geometry");
  });
});

describe("canOpenBimViewer", () => {
  it("opens when geometry is ready even if not published", () => {
    expect(
      canOpenBimViewer(
        status({ fragmentsReady: true, bimPublishedAt: null, conversionStatus: "ready" }),
      ),
    ).toBe(true);
    expect(
      isBimPublishedReady(
        status({ fragmentsReady: true, bimPublishedAt: null, conversionStatus: "ready" }),
      ),
    ).toBe(false);
  });

  it("blocks failed conversions", () => {
    expect(
      canOpenBimViewer(
        status({ fragmentsReady: true, bimPublishedAt: "2026-01-01", conversionStatus: "failed" }),
      ),
    ).toBe(false);
  });
});

describe("needsBimStatusPolling", () => {
  it("does not poll idle unpublished IFCs", () => {
    expect(needsBimStatusPolling({ bimPublishedAt: null }, undefined, null)).toBe(false);
    expect(
      needsBimStatusPolling(
        { bimPublishedAt: null },
        status({ conversionStatus: "ready", quantityIndexReady: true, fragmentsReady: true }),
        null,
      ),
    ).toBe(false);
  });

  it("polls published models until geometry is ready", () => {
    expect(needsBimStatusPolling({ bimPublishedAt: "2026-01-01" }, undefined, null)).toBe(true);
    expect(
      needsBimStatusPolling(
        { bimPublishedAt: "2026-01-01" },
        status({
          bimPublishedAt: "2026-01-01",
          fragmentsReady: false,
          conversionStatus: "running",
        }),
        null,
      ),
    ).toBe(true);
    expect(
      needsBimStatusPolling(
        { bimPublishedAt: "2026-01-01" },
        status({ bimPublishedAt: "2026-01-01", fragmentsReady: true, conversionStatus: "ready" }),
        null,
      ),
    ).toBe(false);
  });

  it("polls active tracked jobs only", () => {
    const job: BimTrackedJob = {
      fileVersionId: "fv1",
      fileId: "f1",
      fileName: "a.ifc",
      projectId: "p",
      workspaceId: "w",
      phase: "indexing",
      uploadPct: 100,
      indexProgress: 10,
      indexPhase: "summary",
      conversionStatus: "running",
      error: null,
      startedAt: 1,
      updatedAt: 1,
    };
    expect(needsBimStatusPolling({ bimPublishedAt: null }, undefined, job)).toBe(true);
    expect(
      needsBimStatusPolling({ bimPublishedAt: null }, undefined, {
        ...job,
        phase: "ready_to_publish",
      }),
    ).toBe(false);
  });
});

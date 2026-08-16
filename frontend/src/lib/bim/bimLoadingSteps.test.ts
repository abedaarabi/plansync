import { describe, expect, it } from "vitest";
import {
  buildLoadSteps,
  buildModelMetaLine,
  formatByteSize,
  overallLoadFraction,
  phaseHeadline,
  stepProgressPercent,
  stripModelExtension,
} from "./bimLoadingSteps";

describe("bimLoadingSteps", () => {
  it("strips ifc extensions", () => {
    expect(stripModelExtension("Tower_A.ifc")).toBe("Tower_A");
    expect(stripModelExtension("pack.IFCZIP")).toBe("pack");
  });

  it("formats byte sizes", () => {
    expect(formatByteSize(900)).toBe("900 B");
    expect(formatByteSize(12_288)).toBe("12 KB");
    expect(formatByteSize(5.2 * 1024 * 1024)).toBe("5.2 MB");
  });

  it("builds meta line with federation index", () => {
    expect(
      buildModelMetaLine({
        fileName: "a.ifc",
        version: 3,
        bytesTotal: 48 * 1024 * 1024,
        modelIndex: 1,
        modelTotal: 4,
      }),
    ).toBe("IFC · v3 · 48 MB · 2 of 4");
  });

  it("uses a short ladder for fast reopen (no Convert)", () => {
    const steps = buildLoadSteps({ kind: "downloading", fraction: 0.4 }, { path: "fast" });
    expect(steps.map((s) => s.id)).toEqual(["resolve", "prepare", "download", "ready"]);
    expect(steps.map((s) => s.label)).toEqual(["Open", "Prepare", "Download", "Ready"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "active", "pending"]);
    expect(phaseHeadline({ kind: "downloading" }, "fast")).toBe("Loading model");
  });

  it("keeps source preparation distinct from downloading", () => {
    const steps = buildLoadSteps({ kind: "preparing" }, { path: "fast" });
    expect(steps.map((s) => s.state)).toEqual(["done", "active", "pending", "pending"]);
    expect(phaseHeadline({ kind: "preparing", index: 1, total: 4 })).toBe("Preparing model 2 of 4");
  });

  it("activates Ready when the overlay completes", () => {
    const steps = buildLoadSteps(
      { kind: "downloading", fraction: 1 },
      { complete: true, path: "fast" },
    );
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "active"]);
    expect(steps.at(-1)?.id).toBe("ready");
  });

  it("includes Convert only on the convert path", () => {
    const steps = buildLoadSteps({ kind: "converting", fraction: 0.4 }, { path: "convert" });
    expect(steps.map((s) => s.id)).toEqual(["resolve", "prepare", "download", "convert", "ready"]);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "active", "pending"]);
    expect(phaseHeadline({ kind: "resolving" })).toBe("Opening 3D workspace");
    expect(stepProgressPercent({ kind: "converting", fraction: 0.42 })).toBe(42);
  });

  it("aggregates federated download progress across models", () => {
    expect(overallLoadFraction(1, 4, 0.5)).toBeCloseTo(0.375);
    expect(
      stepProgressPercent({
        kind: "downloading",
        index: 1,
        total: 4,
        fraction: 0.5,
      }),
    ).toBe(38);
    expect(phaseHeadline({ kind: "downloading", index: 1, total: 4 }, "fast")).toBe(
      "Loading model 2 of 4",
    );
  });

  it("aggregates federated convert progress across models", () => {
    expect(
      stepProgressPercent({
        kind: "converting",
        index: 2,
        total: 3,
        fraction: 0.5,
        label: "C.ifc",
      }),
    ).toBe(83);
    expect(
      phaseHeadline({ kind: "converting", index: 2, total: 3, fraction: 0.5 }, "convert"),
    ).toBe("Converting model 3 of 3");
  });
});

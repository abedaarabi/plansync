import { describe, expect, it } from "vitest";
import {
  buildLoadSteps,
  buildModelMetaLine,
  formatByteSize,
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

  it("maps phase to step ladder", () => {
    const steps = buildLoadSteps({ kind: "converting", fraction: 0.4 });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "active", "pending"]);
    expect(phaseHeadline({ kind: "resolving" })).toBe("Preparing workspace");
    expect(stepProgressPercent({ kind: "converting", fraction: 0.42 })).toBe(42);
  });
});

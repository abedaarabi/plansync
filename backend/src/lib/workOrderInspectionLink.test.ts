import { describe, expect, it } from "vitest";
import { resolveSourceInspectionRunId } from "./workOrderInspectionLink.js";

describe("resolveSourceInspectionRunId", () => {
  it("prefers the column over description metadata", () => {
    expect(
      resolveSourceInspectionRunId({
        sourceInspectionRunId: "  run-col  ",
        description: "Source inspection run: run-desc",
      }),
    ).toBe("run-col");
  });

  it("parses legacy description metadata", () => {
    expect(
      resolveSourceInspectionRunId({
        sourceInspectionRunId: null,
        description: "Follow-up\nSource inspection run: insp_abc123\nMore notes",
      }),
    ).toBe("insp_abc123");
  });

  it("returns null when neither is present", () => {
    expect(
      resolveSourceInspectionRunId({
        sourceInspectionRunId: "   ",
        description: "No link here",
      }),
    ).toBeNull();
  });
});

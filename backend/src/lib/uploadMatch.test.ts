import { describe, expect, it } from "vitest";
import { findBestUploadMatch } from "./uploadMatch.js";

describe("findBestUploadMatch", () => {
  it("matches similar names as new version at high confidence", () => {
    const match = findBestUploadMatch("FloorPlan_RevB.pdf", [
      { id: "f1", name: "Floor Plan.pdf" },
      { id: "f2", name: "Sections.pdf" },
    ]);
    expect(match.kind).toBe("new_version");
    expect(match.matched?.id).toBe("f1");
    expect(match.score).toBeGreaterThan(0.9);
  });

  it("returns new sheet when no close match exists", () => {
    const match = findBestUploadMatch("Elevations.pdf", [{ id: "f1", name: "Floor Plan.pdf" }]);
    expect(match.kind).toBe("new_sheet");
    expect(match.matched).toBeNull();
  });

  it("keeps low confidence suggestions as new sheet", () => {
    const match = findBestUploadMatch(
      "Floor Plan Candidate.pdf",
      [{ id: "f1", name: "Floor Plan Base.pdf" }],
      { suggestThreshold: 0.2, acceptThreshold: 0.95 },
    );
    expect(match.matched?.id).toBe("f1");
    expect(match.kind).toBe("new_sheet");
  });
});

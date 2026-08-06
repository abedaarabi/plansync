import { describe, expect, it } from "vitest";
import { failEvidenceErrors } from "./omInspectionFailEvidence";

describe("failEvidenceErrors", () => {
  const checklist = [
    { id: "1", type: "passfail" },
    { id: "2", type: "text" },
  ];

  it("is a no-op when evidence is not required", () => {
    expect(
      failEvidenceErrors(false, checklist, {
        "1": { outcome: "fail", note: "" },
      }),
    ).toEqual({});
  });

  it("blocks Fail without photo and note", () => {
    expect(
      failEvidenceErrors(true, checklist, {
        "1": { outcome: "fail", note: "" },
        "2": { outcome: null, note: "x" },
      }),
    ).toEqual({ "1": "Fail requires photo and note." });
  });

  it("allows Fail with photo and note", () => {
    expect(
      failEvidenceErrors(true, checklist, {
        "1": {
          outcome: "fail",
          note: "Broken latch",
          photoDataUrl: "data:image/png;base64,xx",
        },
      }),
    ).toEqual({});
  });
});

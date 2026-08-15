import { describe, expect, it } from "vitest";
import { issueEditSchema } from "./IssueEditSlideOver";
import { rfiCreateSchema } from "./RfiCreateSlideOver";
import { rfiEditSchema } from "./RfiEditSlideOver";

const validCreateRfi = {
  dueYmd: "",
  fromDiscipline: "",
  pageNum: "",
  priority: "MEDIUM",
  question: "Confirm the wall assembly at grid B-2.",
  risk: "",
  sheetPick: "",
  title: "Wall assembly clarification",
};

describe("RFI slide-over schemas", () => {
  it("requires a title and question when creating an RFI", () => {
    expect(rfiCreateSchema.safeParse(validCreateRfi).success).toBe(true);
    expect(rfiCreateSchema.safeParse({ ...validCreateRfi, question: " " }).success).toBe(false);
    expect(rfiCreateSchema.safeParse({ ...validCreateRfi, title: " " }).success).toBe(false);
  });

  it("rejects a non-positive drawing page number", () => {
    expect(rfiCreateSchema.safeParse({ ...validCreateRfi, pageNum: "0" }).success).toBe(false);
  });

  it("requires an RFI title when editing", () => {
    expect(
      rfiEditSchema.safeParse({
        dueYmd: "",
        fromDiscipline: "",
        priority: "MEDIUM",
        question: "",
        risk: "",
        title: " ",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-positive page number when editing an issue", () => {
    expect(
      issueEditSchema.safeParse({
        assigneeId: "",
        description: "",
        dueDate: "",
        location: "",
        pageNum: "0",
        priority: "MEDIUM",
        status: "OPEN",
        title: "Missing handrail",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { issueCreateSchema } from "./IssueCreateSlideOver";

const validIssue = {
  assigneeId: "",
  description: "",
  dueDate: "",
  location: "",
  pageNum: "",
  priority: "MEDIUM",
  sheetPick: "",
  status: "OPEN",
  title: "Missing handrail",
};

describe("issueCreateSchema", () => {
  it("accepts a title and optional issue details", () => {
    expect(issueCreateSchema.safeParse(validIssue).success).toBe(true);
  });

  it("requires a meaningful title", () => {
    const result = issueCreateSchema.safeParse({ ...validIssue, title: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects a non-positive drawing page number", () => {
    const result = issueCreateSchema.safeParse({ ...validIssue, pageNum: "0" });

    expect(result.success).toBe(false);
  });
});

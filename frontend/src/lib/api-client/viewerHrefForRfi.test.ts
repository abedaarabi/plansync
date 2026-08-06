import { describe, expect, it } from "vitest";
import { viewerHrefForLinkedIssue, viewerHrefForRfi } from "./core-issues-takeoff";
import type { RfiIssueRef, RfiRow } from "./core-members-viewer-rfi";

function linkedIssue(over: Partial<RfiIssueRef> = {}): RfiIssueRef {
  return {
    id: "issue-9",
    title: "Pin A",
    fileId: "file-1",
    fileVersionId: "fv-1",
    pageNumber: 1,
    sheetName: "A-101",
    sheetVersion: 3,
    ...over,
  };
}

function baseRfi(over: Partial<RfiRow> = {}): RfiRow {
  return {
    id: "rfi-1",
    projectId: "proj-1",
    rfiNumber: 12,
    title: "Clearance",
    description: null,
    status: "OPEN",
    priority: "MED",
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    creatorId: "u1",
    creator: null,
    assignedToUserId: null,
    assignedTo: null,
    assignees: [],
    answerMessageId: null,
    officialResponse: null,
    voidReason: null,
    risk: null,
    fromDiscipline: null,
    pageNumber: null,
    pinNormX: null,
    pinNormY: null,
    lastOverdueNotifiedAt: null,
    fileId: "file-1",
    fileVersionId: "fv-1",
    file: { id: "file-1", name: "Drawings.pdf" },
    fileVersion: { id: "fv-1", version: 2, fileId: "file-1" },
    issues: [linkedIssue()],
    attachments: [],
    ...over,
  };
}

describe("viewerHrefForLinkedIssue", () => {
  it("builds a viewer URL for the selected linked issue", () => {
    const href = viewerHrefForLinkedIssue("proj-1", linkedIssue(), "Sheet");
    expect(href.startsWith("/viewer?")).toBe(true);
    expect(href).toContain("fileId=file-1");
    expect(href).toContain("fileVersionId=fv-1");
    expect(href).toContain("projectId=proj-1");
    expect(href).toContain("issueId=issue-9");
    expect(href).toContain("name=A-101");
    expect(href).toContain("version=3");
  });

  it("falls back to the provided sheet name", () => {
    const href = viewerHrefForLinkedIssue(
      "proj-1",
      linkedIssue({ sheetName: null, sheetVersion: null }),
      "Fallback Sheet",
    );
    expect(href).toContain("name=Fallback+Sheet");
    expect(href).not.toContain("version=");
  });
});

describe("viewerHrefForRfi", () => {
  it("returns null when no file is linked", () => {
    expect(
      viewerHrefForRfi(
        baseRfi({
          fileId: null,
          fileVersionId: null,
          file: null,
          fileVersion: null,
          issues: [],
        }),
        "proj-1",
      ),
    ).toBeNull();
  });

  it("includes first linked issue id when present", () => {
    const href = viewerHrefForRfi(baseRfi(), "proj-1");
    expect(href).toContain("/viewer?");
    expect(href).toContain("issueId=issue-9");
    expect(href).toContain("name=Drawings.pdf");
  });
});

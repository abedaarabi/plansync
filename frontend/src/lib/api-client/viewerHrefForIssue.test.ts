import { describe, expect, it } from "vitest";
import { federationExtrasForIssue, viewerHrefForIssue, type IssueRow } from "./core-issues-takeoff";

function baseIssue(over: Partial<IssueRow> = {}): IssueRow {
  return {
    id: "issue-1",
    workspaceId: "ws-1",
    projectId: "proj-1",
    fileId: "file-a",
    fileVersionId: "fv-a",
    title: "Clash",
    description: null,
    status: "OPEN",
    annotationId: null,
    assigneeId: null,
    creatorId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignee: null,
    creator: null,
    file: { name: "A.ifc" },
    fileVersion: { version: 1 },
    linkedRfis: [],
    ...over,
  };
}

describe("federationExtrasForIssue", () => {
  it("returns the partner model when clash has two distinct versions", () => {
    const extras = federationExtrasForIssue(
      baseIssue({
        bimAnchor: {
          ifcGuid: "g-a",
          fileVersionId: "fv-a",
          fileId: "file-a",
          modelFileName: "A.ifc",
          ifcGuidB: "g-b",
          fileVersionIdB: "fv-b",
          fileIdB: "file-b",
          modelFileNameB: "B.ifc",
        },
      }),
    );
    expect(extras).toEqual([{ fileId: "file-b", fileVersionId: "fv-b", name: "B.ifc" }]);
  });

  it("returns empty for single-model / self-clash anchors", () => {
    expect(
      federationExtrasForIssue(
        baseIssue({
          bimAnchor: {
            ifcGuid: "g-a",
            fileVersionId: "fv-a",
            fileId: "file-a",
            ifcGuidB: "g-b",
            fileVersionIdB: "fv-a",
            fileIdB: "file-a",
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe("viewerHrefForIssue", () => {
  it("includes models= for federated clash issues", () => {
    const href = viewerHrefForIssue(
      baseIssue({
        bimAnchor: {
          ifcGuid: "g-a",
          fileVersionId: "fv-a",
          fileId: "file-a",
          ifcGuidB: "g-b",
          fileVersionIdB: "fv-b",
          fileIdB: "file-b",
          modelFileNameB: "B.ifc",
        },
      }),
    );
    expect(href).toContain("/bim-viewer?");
    expect(href).toContain("models=");
    expect(href).toContain(encodeURIComponent("fv-b"));
  });

  it("omits models= for single-model BIM issues", () => {
    const href = viewerHrefForIssue(
      baseIssue({
        bimAnchor: { ifcGuid: "g-a", fileVersionId: "fv-a", fileId: "file-a" },
      }),
    );
    expect(href).toContain("/bim-viewer?");
    expect(href).not.toContain("models=");
  });
});

import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import { buildProjectTeamMembers } from "./projectTeamMembers.js";

describe("buildProjectTeamMembers", () => {
  it("includes full-workspace members for every project", () => {
    const rows = buildProjectTeamMembers(
      [
        {
          userId: "u1",
          name: "A",
          email: "a@x.com",
          workspaceRole: WorkspaceRole.ADMIN,
        },
      ],
      [],
      "p1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].access).toBe("full");
    expect(rows[0].canRemoveFromProject).toBe(false);
  });

  it("includes only scoped members assigned to this project", () => {
    const rows = buildProjectTeamMembers(
      [
        {
          userId: "u1",
          name: "Scoped",
          email: "s@x.com",
          workspaceRole: WorkspaceRole.MEMBER,
        },
        {
          userId: "u2",
          name: "Other",
          email: "o@x.com",
          workspaceRole: WorkspaceRole.MEMBER,
        },
      ],
      [
        { userId: "u1", projectId: "p1" },
        { userId: "u2", projectId: "p2" },
      ],
      "p1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("u1");
    expect(rows[0].access).toBe("project");
    expect(rows[0].canRemoveFromProject).toBe(true);
  });
});

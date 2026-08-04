import { describe, expect, it } from "vitest";
import { isProjectAccessError, type ProjectMemberAccess } from "./permissions.js";

describe("isProjectAccessError", () => {
  it("treats denied access as an error (truthy { error } is still denied)", () => {
    const denied: ProjectMemberAccess = { error: "Forbidden", status: 403 };
    // The old bug: if (!denied) never runs because objects are truthy.
    expect(!denied).toBe(false);
    expect(isProjectAccessError(denied)).toBe(true);
    if (isProjectAccessError(denied)) {
      expect(denied.status).toBe(403);
      expect(denied.error).toBe("Forbidden");
    }
  });

  it("treats allowed access as not an error", () => {
    const allowed = {
      project: { id: "p1" },
    } as ProjectMemberAccess;
    expect(isProjectAccessError(allowed)).toBe(false);
  });

  it("treats not-found the same as forbidden for the discriminator", () => {
    const missing: ProjectMemberAccess = { error: "Not found", status: 404 };
    expect(isProjectAccessError(missing)).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadProjectForMember = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());

vi.mock("../../lib/projectAccess.js", () => ({
  loadProjectForMember: (...args: unknown[]) => loadProjectForMember(...args),
  isProjectAccessError: (access: object) => "error" in access,
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    fileVersion: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

vi.mock("../../lib/s3.js", () => ({ getObjectStream: vi.fn() }));
vi.mock("../../lib/bim/quantityIndexBuilder.js", () => ({
  parseQuantityIndexBuffer: vi.fn(),
}));
vi.mock("../../lib/bim/streamUtils.js", () => ({ webStreamToBuffer: vi.fn() }));
vi.mock("../../lib/subscription.js", () => ({ isWorkspacePro: () => true }));

import { authorizeBimFileVersion } from "./bimRouteHelpers.js";

function mockContext(userId: string) {
  return {
    get: (key: string) => (key === "user" ? { id: userId } : undefined),
    json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }),
  };
}

const fileVersionRow = {
  id: "fv_1",
  file: {
    projectId: "project_b",
    project: { workspace: { subscriptionStatus: "active" } },
  },
};

describe("authorizeBimFileVersion tenancy", () => {
  beforeEach(() => {
    loadProjectForMember.mockReset();
    findUnique.mockReset();
    findUnique.mockResolvedValue(fileVersionRow);
  });

  it("returns 403 when loadProjectForMember denies access (truthy { error })", async () => {
    loadProjectForMember.mockResolvedValue({ error: "Forbidden", status: 403 });

    const result = await authorizeBimFileVersion(mockContext("user_a") as never, "fv_1");

    expect(loadProjectForMember).toHaveBeenCalledWith("project_b", "user_a");
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response).toEqual({ body: { error: "Forbidden" }, status: 403 });
    }
  });

  it("returns the file version when the user is a project member", async () => {
    loadProjectForMember.mockResolvedValue({
      project: { id: "project_b", workspace: { subscriptionStatus: "active" } },
    });

    const result = await authorizeBimFileVersion(mockContext("user_b") as never, "fv_1");

    expect("fv" in result).toBe(true);
    if ("fv" in result) {
      expect(result.fv.id).toBe("fv_1");
    }
  });
});

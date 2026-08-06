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

describe("authorizeBimFileVersion Pro+ gate", () => {
  beforeEach(() => {
    loadProjectForMember.mockReset();
    findUnique.mockReset();
  });

  it("returns 402 for Team billingPlan when requirePro is set", async () => {
    findUnique.mockResolvedValue({
      id: "fv_1",
      file: {
        projectId: "p1",
        project: {
          workspace: { subscriptionStatus: "active", billingPlan: "team" },
        },
      },
    });
    loadProjectForMember.mockResolvedValue({
      project: {
        id: "p1",
        workspace: { subscriptionStatus: "active", billingPlan: "team" },
      },
    });

    const result = await authorizeBimFileVersion(mockContext("u1") as never, "fv_1", {
      requirePro: true,
    });

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response).toEqual({
        body: { error: "Pro subscription required for BIM" },
        status: 402,
      });
    }
  });

  it("allows Pro billingPlan when requirePro is set", async () => {
    findUnique.mockResolvedValue({
      id: "fv_1",
      file: {
        projectId: "p1",
        project: {
          workspace: { subscriptionStatus: "active", billingPlan: "pro" },
        },
      },
    });
    loadProjectForMember.mockResolvedValue({
      project: {
        id: "p1",
        workspace: { subscriptionStatus: "active", billingPlan: "pro" },
      },
    });

    const result = await authorizeBimFileVersion(mockContext("u1") as never, "fv_1", {
      requirePro: true,
    });

    expect("fv" in result).toBe(true);
  });
});

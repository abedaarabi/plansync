import { describe, expect, it } from "vitest";
import type { MeResponse } from "@/types/enterprise";
import {
  meHasProWorkspace,
  viewerHasProPlusSheetFeatures,
  viewerHasProSheetFeatures,
} from "./proWorkspace";

function meWithPlan(billingPlan: string | null, status = "active"): MeResponse {
  return {
    user: { id: "u1", name: "Ada", email: "ada@example.com" },
    workspaces: [
      {
        workspaceId: "w1",
        role: "SUPER_ADMIN",
        workspace: {
          id: "w1",
          name: "Acme",
          slug: "acme",
          storageQuotaBytes: "1",
          storageUsedBytes: "0",
          subscriptionStatus: status,
          billingPlan,
        },
      },
    ],
  };
}

describe("viewer sheet gating", () => {
  it("disables sheet Pro features for local / blob opens", () => {
    const me = meWithPlan("pro");
    expect(viewerHasProSheetFeatures(me, null)).toBe(false);
    expect(viewerHasProPlusSheetFeatures(me, null)).toBe(false);
  });

  it("allows Team cloud sheet features but not takeoff", () => {
    const me = meWithPlan("team");
    expect(meHasProWorkspace(me)).toBe(true);
    expect(viewerHasProSheetFeatures(me, "fv_1")).toBe(true);
    expect(viewerHasProPlusSheetFeatures(me, "fv_1")).toBe(false);
  });

  it("allows Pro+ takeoff on cloud sheets", () => {
    expect(viewerHasProPlusSheetFeatures(meWithPlan("pro"), "fv_1")).toBe(true);
    expect(viewerHasProPlusSheetFeatures(meWithPlan("enterprise"), "fv_1")).toBe(true);
  });

  it("denies free workspaces", () => {
    const me = meWithPlan(null, "canceled");
    expect(meHasProWorkspace(me)).toBe(false);
    expect(viewerHasProSheetFeatures(me, "fv_1")).toBe(false);
  });
});

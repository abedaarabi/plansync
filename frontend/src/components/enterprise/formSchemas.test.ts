import { describe, expect, it } from "vitest";
import { fieldReportCreateSchema } from "./FieldReportCreateSlideOver";
import { issueEditSchema } from "./IssueEditSlideOver";
import { materialsFormSchema } from "./materials/MaterialsFormSlideOver";
import { partsInventoryCreateSchema } from "./OmPartsInventoryClient";
import { workspaceInviteSchema } from "./WorkspaceTeamClient";
import { organizationBrandingSchema } from "./organization/OrganizationBrandingPanel";

describe("issueEditSchema", () => {
  it("requires a meaningful title", () => {
    expect(
      issueEditSchema.safeParse({
        assigneeId: "",
        description: "",
        dueDate: "",
        location: "",
        pageNum: "",
        priority: "MEDIUM",
        status: "OPEN",
        title: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("materialsFormSchema", () => {
  it("requires a material name and type", () => {
    expect(materialsFormSchema.safeParse({ materialType: "Steel", name: " " }).success).toBe(false);
    expect(materialsFormSchema.safeParse({ materialType: " ", name: "W12x26" }).success).toBe(
      false,
    );
  });
});

describe("organizationBrandingSchema", () => {
  it("rejects invalid website and primary color values", () => {
    expect(
      organizationBrandingSchema.safeParse({
        description: "",
        name: "Acme",
        primaryColor: "#123",
        slug: "acme",
        website: "not a url",
      }).success,
    ).toBe(false);
  });
});

describe("workspaceInviteSchema", () => {
  it("requires projects for external invites", () => {
    expect(
      workspaceInviteSchema.safeParse({
        email: "client@example.com",
        inviteKind: "CLIENT",
        inviteeCompany: "",
        inviteeName: "",
        projectIds: [],
        role: "MEMBER",
        trade: "",
      }).success,
    ).toBe(false);
  });
});

describe("fieldReportCreateSchema", () => {
  it("requires a report date", () => {
    expect(fieldReportCreateSchema.safeParse({ author: "", reportDate: "" }).success).toBe(false);
  });
});

describe("partsInventoryCreateSchema", () => {
  it("accepts non-negative whole stock amounts", () => {
    expect(
      partsInventoryCreateSchema.safeParse({
        name: "Filter",
        quantity: "12",
        reorderLevel: "3",
        unitCost: "4.50",
      }).success,
    ).toBe(true);
  });
});

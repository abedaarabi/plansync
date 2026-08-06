import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanUpgradeCallout } from "./PlanUpgradeCallout";

describe("PlanUpgradeCallout", () => {
  it("defaults to Pro upgrade copy and billing link", () => {
    render(<PlanUpgradeCallout feature="Takeoff" />);
    expect(screen.getByText("Takeoff requires Pro")).toBeTruthy();
    expect(screen.getByText(/Upgrade to Pro for takeoff, proposals, and BIM/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /View plans & billing/i });
    expect(link.getAttribute("href")).toBe("/organization?tab=billing");
  });

  it("uses Enterprise copy when requiredPlan is Enterprise", () => {
    render(<PlanUpgradeCallout feature="O&M" requiredPlan="Enterprise" />);
    expect(screen.getByText("O&M requires Enterprise")).toBeTruthy();
    expect(
      screen.getByText(/Upgrade this workspace to Enterprise to unlock Operations/),
    ).toBeTruthy();
  });

  it("shows custom detail when provided", () => {
    render(<PlanUpgradeCallout feature="BIM" detail="Ask your Super Admin to upgrade." />);
    expect(screen.getByText("Ask your Super Admin to upgrade.")).toBeTruthy();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BillingPlanCards } from "./BillingPlanCards";

afterEach(() => cleanup());

describe("BillingPlanCards", () => {
  it("renders Team / Pro / Enterprise prices from the catalog", () => {
    render(
      <BillingPlanCards
        currentPlan={null}
        busy={null}
        canChangePlan={false}
        hasStripeCustomer={false}
        onCheckout={() => {}}
        onRequestChange={() => {}}
      />,
    );
    expect(screen.getByText("$99")).toBeTruthy();
    expect(screen.getByText("$179")).toBeTruthy();
    expect(screen.getByText("$299")).toBeTruthy();
  });

  it("starts checkout when there is no active subscription to switch", () => {
    const onCheckout = vi.fn();
    const onRequestChange = vi.fn();
    render(
      <BillingPlanCards
        currentPlan={null}
        busy={null}
        canChangePlan={false}
        hasStripeCustomer={false}
        onCheckout={onCheckout}
        onRequestChange={onRequestChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue with Pro" }));
    expect(onCheckout).toHaveBeenCalledWith("pro");
    expect(onRequestChange).not.toHaveBeenCalled();
  });

  it("requests a plan change when canChangePlan is true", () => {
    const onCheckout = vi.fn();
    const onRequestChange = vi.fn();
    render(
      <BillingPlanCards
        currentPlan="team"
        busy={null}
        canChangePlan
        hasStripeCustomer
        onCheckout={onCheckout}
        onRequestChange={onRequestChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Current plan" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Pro" }));
    expect(onRequestChange).toHaveBeenCalledWith("pro");
    expect(onCheckout).not.toHaveBeenCalled();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseButton } from "./EnterpriseButton";

afterEach(cleanup);

describe("EnterpriseButton", () => {
  it("renders primary variant with full width", () => {
    render(<EnterpriseButton fullWidth>Save</EnterpriseButton>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).toContain("w-full");
    expect(btn.className).toContain("bg-[var(--enterprise-primary)]");
  });

  it("disables when loading and exposes busy state with spinner", () => {
    render(<EnterpriseButton loading>Next</EnterpriseButton>);
    const btn = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.querySelector("svg")).toBeTruthy();
  });

  it("keeps soft distinct from neutral secondary", () => {
    const { rerender } = render(<EnterpriseButton variant="secondary">Neutral</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "Neutral" }).className).toContain(
      "bg-[var(--enterprise-surface)]",
    );

    rerender(<EnterpriseButton variant="soft">Soft</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "Soft" }).className).toContain(
      "bg-[var(--enterprise-primary-soft)]",
    );
    expect(screen.getByRole("button", { name: "Soft" }).className).toContain(
      "text-[var(--enterprise-primary)]",
    );
  });

  it("applies size intent classes", () => {
    const { rerender } = render(<EnterpriseButton size="sm">Small</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain("min-h-9");

    rerender(<EnterpriseButton size="md">Medium</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "Medium" }).className).toContain("min-h-10");

    rerender(<EnterpriseButton size="lg">Large</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "Large" }).className).toContain("min-h-11");
  });

  it("supports danger and ghost variants", () => {
    const { rerender } = render(<EnterpriseButton variant="danger">Delete</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain(
      "bg-[var(--enterprise-error)]",
    );

    rerender(<EnterpriseButton variant="ghost">More</EnterpriseButton>);
    expect(screen.getByRole("button", { name: "More" }).className).toContain("bg-transparent");
  });
});

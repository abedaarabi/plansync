import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnterpriseButton } from "./EnterpriseButton";

describe("EnterpriseButton", () => {
  it("renders primary variant with full width", () => {
    render(<EnterpriseButton fullWidth>Save</EnterpriseButton>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.className).toContain("w-full");
    expect(btn.className).toContain("bg-[var(--enterprise-primary)]");
  });

  it("disables when loading", () => {
    render(<EnterpriseButton loading>Next</EnterpriseButton>);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

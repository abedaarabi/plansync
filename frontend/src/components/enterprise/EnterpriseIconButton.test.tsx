import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { EnterpriseIconButton } from "./EnterpriseIconButton";

describe("EnterpriseIconButton", () => {
  it("exposes accessible name and toolbar focus ring styling", () => {
    render(
      <EnterpriseIconButton aria-label="Search" type="button">
        <Search className="h-4 w-4" aria-hidden />
      </EnterpriseIconButton>,
    );
    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn.className).toContain("focus-visible:ring-2");
    expect(btn.className).toContain("min-h-9");
  });
});

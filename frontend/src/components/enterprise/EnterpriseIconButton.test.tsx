import { cleanup, render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseIconButton } from "./EnterpriseIconButton";

afterEach(cleanup);

describe("EnterpriseIconButton", () => {
  it("exposes accessible name and toolbar focus ring styling", () => {
    render(
      <EnterpriseIconButton aria-label="Search" type="button">
        <Search className="h-4 w-4" aria-hidden />
      </EnterpriseIconButton>,
    );
    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn.className).toContain("focus-visible:ring-2");
    expect(btn.className).toContain("min-h-8");
  });

  it("supports ghost and touch-sized targets", () => {
    render(
      <EnterpriseIconButton aria-label="Filter" variant="ghost" size="md">
        <Search className="h-4 w-4" aria-hidden />
      </EnterpriseIconButton>,
    );
    const btn = screen.getByRole("button", { name: "Filter" });
    expect(btn.className).toContain("bg-transparent");
    expect(btn.className).toContain("min-h-[44px]");
  });

  it("honors disabled state", () => {
    render(
      <EnterpriseIconButton aria-label="Search" disabled>
        <Search className="h-4 w-4" aria-hidden />
      </EnterpriseIconButton>,
    );
    expect((screen.getByRole("button", { name: "Search" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

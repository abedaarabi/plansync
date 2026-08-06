import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsToggleRow } from "./SettingsToggleRow";

describe("SettingsToggleRow", () => {
  it("shows On/Off and toggles via the switch", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SettingsToggleRow
        label="Issues"
        description="Track field issues"
        on={false}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("Off")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Issues toggle" }));
    expect(onToggle).toHaveBeenCalledWith(true);

    rerender(
      <SettingsToggleRow label="Issues" description="Track field issues" on onToggle={onToggle} />,
    );
    expect(screen.getByText("On")).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("does not toggle when disabled", () => {
    const onToggle = vi.fn();
    render(<SettingsToggleRow label="RFIs" on={true} onToggle={onToggle} disabled />);
    fireEvent.click(screen.getByRole("switch", { name: "RFIs toggle" }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

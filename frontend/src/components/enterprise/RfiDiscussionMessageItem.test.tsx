import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RfiDiscussionMessageItem } from "./RfiDiscussionMessageItem";

afterEach(() => cleanup());

const base = {
  authorName: "Ada Lovelace",
  authorEmail: "ada@example.com",
  authorImage: null as string | null,
  bodyHtml: "<p>Need clearance confirmed.</p>",
  createdAtIso: "2026-08-06T14:00:00.000Z",
  timeLabel: "2h",
};

describe("RfiDiscussionMessageItem", () => {
  it("renders peer bubbles with author name", () => {
    render(<RfiDiscussionMessageItem {...base} />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Need clearance confirmed.")).toBeTruthy();
    const item = screen.getByRole("listitem");
    expect(item.className).not.toContain("flex-row-reverse");
  });

  it("aligns mine bubbles to the right and labels You", () => {
    const { container } = render(<RfiDiscussionMessageItem {...base} isMine />);
    const item = within(container).getByRole("listitem");
    expect(within(item).getByText("You")).toBeTruthy();
    expect(within(item).queryByText("Ada Lovelace")).toBeNull();
    expect(item.className).toContain("flex-row-reverse");
  });

  it("shows official answer badge", () => {
    render(<RfiDiscussionMessageItem {...base} isRecordedAnswer />);
    expect(screen.getByText("Answer")).toBeTruthy();
  });

  it("invokes answer picker callback", () => {
    const onToggle = vi.fn();
    render(<RfiDiscussionMessageItem {...base} showAnswerPicker onTogglePickAsAnswer={onToggle} />);
    fireEvent.click(
      screen.getByRole("button", { name: /use this message as the official answer/i }),
    );
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

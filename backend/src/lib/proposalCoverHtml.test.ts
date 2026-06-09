import { describe, expect, it } from "vitest";
import { proposalCoverTextToHtml } from "./proposalCoverHtml.js";

describe("proposalCoverTextToHtml", () => {
  it("returns empty for blank input", () => {
    expect(proposalCoverTextToHtml("   ")).toBe("");
  });

  it("converts markdown paragraphs to HTML", () => {
    const html = proposalCoverTextToHtml(
      "Dear Client,\n\nThank you for the opportunity.\n\nBest regards",
    );
    expect(html).toContain("<p>");
    expect(html).toContain("Dear Client");
    expect(html).toContain("Thank you for the opportunity");
    expect(html).toContain("Best regards");
  });

  it("preserves already-sanitized HTML", () => {
    const input = "<p>Hello <strong>world</strong></p>";
    expect(proposalCoverTextToHtml(input)).toBe(input);
  });

  it("converts markdown bold to strong tags", () => {
    const html = proposalCoverTextToHtml("**Important** note");
    expect(html).toMatch(/<(strong|b)>/);
    expect(html).toContain("Important");
  });
});

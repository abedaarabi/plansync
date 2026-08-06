import { describe, expect, it } from "vitest";
import {
  isRfiRichTextEffectivelyEmpty,
  rfiRichTextPlainExcerpt,
  sanitizeRfiMessageHtml,
} from "./sanitizeRfiRichText.js";

describe("sanitizeRfiMessageHtml", () => {
  it("keeps TipTap document marks, headings, tables, and images", () => {
    const html = sanitizeRfiMessageHtml(
      [
        "<h2>Site question</h2>",
        "<p>Please confirm <strong>clearance</strong> and <u>dimension</u>.</p>",
        "<table><thead><tr><th>Item</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>",
        '<p><img src="https://example.com/a.png" alt="detail"></p>',
      ].join(""),
    );
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>");
    expect(html).toContain("<u>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain('src="https://example.com/a.png"');
  });

  it("keeps @mention chips that include data-id", () => {
    const html = sanitizeRfiMessageHtml(
      '<p>Hi <span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span></p>',
    );
    expect(html).toContain('data-type="mention"');
    expect(html).toContain('data-id="user-1"');
    expect(html).toContain("@Ada");
  });

  it("strips mention chips missing data-id", () => {
    const html = sanitizeRfiMessageHtml(
      '<p>Hi <span data-type="mention" data-label="Ada">@Ada</span> there</p>',
    );
    expect(html).not.toContain("data-type");
    expect(html).not.toContain("@Ada");
    expect(html).toContain("Hi");
    expect(html).toContain("there");
  });

  it("strips script tags", () => {
    const html = sanitizeRfiMessageHtml("<p>ok</p><script>alert(1)</script>");
    expect(html).toContain("<p>ok</p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
  });

  it("throws when raw input exceeds the size cap", () => {
    const huge = `<p>${"x".repeat(120_001)}</p>`;
    expect(() => sanitizeRfiMessageHtml(huge)).toThrow(/exceeds/i);
  });
});

describe("isRfiRichTextEffectivelyEmpty", () => {
  it("treats empty tags as empty", () => {
    expect(isRfiRichTextEffectivelyEmpty("<p></p>")).toBe(true);
    expect(isRfiRichTextEffectivelyEmpty("   ")).toBe(true);
  });

  it("detects text content", () => {
    expect(isRfiRichTextEffectivelyEmpty("<p>hello</p>")).toBe(false);
  });
});

describe("rfiRichTextPlainExcerpt", () => {
  it("returns plain text without tags", () => {
    expect(rfiRichTextPlainExcerpt("<p>Hello <strong>world</strong></p>", 100)).toBe("Hello world");
  });

  it("truncates with ellipsis", () => {
    expect(rfiRichTextPlainExcerpt("<p>abcdefghij</p>", 5)).toBe("abcde…");
  });
});

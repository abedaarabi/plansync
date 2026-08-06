import { describe, expect, it } from "vitest";
import { sanitizeProposalCoverHtml } from "./proposalSanitize.js";

describe("sanitizeProposalCoverHtml", () => {
  it("preserves Word-like TipTap structures used by the cover editor", () => {
    const html = sanitizeProposalCoverHtml(
      [
        "<h1>Cover</h1>",
        '<p style="text-align:center">Centered</p>',
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled> Done</label></li></ul>',
        '<table class="proposal-cover-table"><tr><th>A</th><td>B</td></tr></table>',
        '<p><span data-type="mention" data-id="client.name" data-label="client.name" class="proposal-merge-chip">{{client.name}}</span></p>',
      ].join(""),
    );
    expect(html).toContain("<h1>");
    expect(html).toContain("Centered");
    expect(html).toContain("taskList");
    expect(html).toContain("<table");
    expect(html).toContain('data-id="client.name"');
  });

  it("keeps safe https images and drops scripts", () => {
    const html = sanitizeProposalCoverHtml(
      '<p><img src="https://cdn.example.com/x.jpg" alt="x"><script>evil()</script></p>',
    );
    expect(html).toContain('src="https://cdn.example.com/x.jpg"');
    expect(html).not.toContain("script");
    expect(html).not.toContain("evil");
  });

  it("returns empty for blank input", () => {
    expect(sanitizeProposalCoverHtml("   ")).toBe("");
  });
});

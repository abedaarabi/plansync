import { describe, expect, it } from "vitest";
import {
  resolveProposalMergePreview,
  wrapProposalMergeFieldsAsMentions,
} from "./proposalCoverMerge";

describe("wrapProposalMergeFieldsAsMentions", () => {
  it("wraps merge tokens as TipTap mention chips", () => {
    const html = wrapProposalMergeFieldsAsMentions("<p>Dear {{client.name}},</p>");
    expect(html).toContain('data-type="mention"');
    expect(html).toContain('data-id="client.name"');
    expect(html).toContain("{{client.name}}");
  });

  it("uses an empty paragraph when content is blank", () => {
    expect(wrapProposalMergeFieldsAsMentions("")).toBe("<p></p>");
  });
});

describe("resolveProposalMergePreview", () => {
  it("substitutes known values and highlights missing fields", () => {
    const html = resolveProposalMergePreview("<p>{{client.name}} / {{missing}}</p>", {
      "client.name": "Acme <Co>",
    });
    expect(html).toContain("Acme &lt;Co&gt;");
    expect(html).toContain('class="proposal-merge-missing"');
    expect(html).toContain("{{missing}}");
  });
});

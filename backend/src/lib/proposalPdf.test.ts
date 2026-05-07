import { describe, expect, it } from "vitest";
import { proposalCoverPlainForPdf } from "./proposalPdf.js";

describe("proposalCoverPlainForPdf", () => {
  it("returns empty for blank input", () => {
    expect(proposalCoverPlainForPdf("   ")).toBe("");
  });

  it("converts simple markdown line to plain text", () => {
    const out = proposalCoverPlainForPdf("# Hello\n\nWorld.");
    expect(out).toMatch(/Hello/);
    expect(out).toMatch(/World/);
  });
});

import { describe, expect, it } from "vitest";
import { buildMarketingLandingSystemPrompt } from "./marketingLandingKnowledge.js";

describe("buildMarketingLandingSystemPrompt", () => {
  it("includes all plan tiers and key solutions", () => {
    const prompt = buildMarketingLandingSystemPrompt("en");
    expect(prompt).toContain("Free");
    expect(prompt).toContain("$49/month");
    expect(prompt).toContain("$99/month");
    expect(prompt).toContain("Quantity takeoff");
    expect(prompt).toContain("Tenant portal");
    expect(prompt).toContain("RFI workflow");
    expect(prompt).toContain("O&M + handover");
  });

  it("prefers Arabic for ar locale", () => {
    const prompt = buildMarketingLandingSystemPrompt("ar");
    expect(prompt).toContain("Prefer Arabic");
  });

  it("does not expose internal implementation details", () => {
    const prompt = buildMarketingLandingSystemPrompt();
    expect(prompt).not.toContain("gemini");
    expect(prompt).not.toContain("API key");
  });
});

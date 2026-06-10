import { describe, expect, it } from "vitest";
import {
  buildMarketingEmailHtml,
  buildMarketingEmailText,
  parseMarketingRecipients,
  resolveMarketingAppUrl,
} from "./marketingEmail.js";

describe("parseMarketingRecipients", () => {
  it("parses standard columns and dedupes", () => {
    const { recipients, skipped } = parseMarketingRecipients([
      { email: "a@co.com", company: "A Co", name: "Ann" },
      { Email: "B@CO.COM", "Company Name": "B Co" },
      { email: "a@co.com" },
      { company: "No email" },
    ]);

    expect(recipients).toEqual([
      { email: "a@co.com", company: "A Co", name: "Ann" },
      { email: "b@co.com", company: "B Co", name: undefined },
    ]);
    expect(skipped).toHaveLength(2);
  });
});

describe("buildMarketingEmailHtml", () => {
  it("includes personalized founder note, offer, and preview images", () => {
    const html = buildMarketingEmailHtml({ email: "x@y.com", name: "Sam" });
    expect(html).toContain("Hi Sam,");
    expect(html).toContain("founder of PlanSync");
    expect(html).toContain("From PDF drawing to sent proposal");
    expect(html).toContain("6 months of Pro");
    expect(html).toContain("Open the PDF");
    expect(html).toContain("Send the proposal");
    expect(html).toContain("✓ O&amp;M handover &amp; FM");
    expect(html).toContain("✓ Full takeoff &amp; proposals");
    expect(html).toContain("✓ Unlimited projects");
    expect(html).toContain("✓ Reply for a walkthrough");
    expect(html).toContain("https://plansync.dev/images/measure.png");
    expect(html).toContain('width="200"');
    expect(html).toContain("7g1qpgmHNg0");
    expect(html).toContain("linkedin.com/company/plansyncdev");
  });

  it("uses production app URL when publicAppUrl is localhost", () => {
    const html = buildMarketingEmailHtml(
      { email: "x@y.com", name: "Sam" },
      { publicAppUrl: "http://localhost:3000" },
    );
    expect(html).toContain("https://plansync.dev/icons/icon-180.png");
    expect(html).toContain("https://plansync.dev/images/measure.png");
    expect(html).toContain("https://plansync.dev/sign-in");
    expect(html).toContain("plansync.dev</a></p>");
    expect(html).not.toContain("localhost:3000");
  });

  it("resolveMarketingAppUrl prefers MARKETING_APP_URL", () => {
    const prev = process.env.MARKETING_APP_URL;
    process.env.MARKETING_APP_URL = "https://staging.plansync.dev";
    try {
      expect(resolveMarketingAppUrl("http://localhost:3000")).toBe("https://staging.plansync.dev");
    } finally {
      if (prev === undefined) delete process.env.MARKETING_APP_URL;
      else process.env.MARKETING_APP_URL = prev;
    }
  });

  it("embeds inline player in preview mode", () => {
    const html = buildMarketingEmailHtml(
      { email: "x@y.com" },
      { embedVideo: true, previewOrigin: "http://127.0.0.1:8765" },
    );
    expect(html).toContain("youtube.com/embed/7g1qpgmHNg0");
    expect(html).toContain("<iframe");
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(html).toContain('name="referrer" content="strict-origin-when-cross-origin"');
    expect(html).toContain("origin=http");
    expect(html).not.toContain("Watch on YouTube");
    expect(html).not.toContain("Play demo");
  });

  it("uses clickable thumbnail when not embedding", () => {
    const html = buildMarketingEmailHtml({ email: "x@y.com" });
    expect(html).toContain("Play demo");
    expect(html).toContain("Watch the 2-minute walkthrough on YouTube");
    expect(html).toContain("background-image:url");
    expect(html).not.toContain("<iframe");
  });

  it("plain text includes founder note and value copy", () => {
    const text = buildMarketingEmailText({ email: "x@y.com", company: "BuildCo" });
    expect(text).toContain("Hi BuildCo team, I'm Abed, founder of PlanSync.");
    expect(text).toContain("https://plansync.dev/sign-in");
    expect(text).toContain("Open the PDF");
    expect(text).toContain("✓ O&M handover & FM");
    expect(text).toContain("✓ Full takeoff & proposals");
  });
});

import Script from "next/script";

/**
 * Self-hosted Umami. Set at build time:
 * NEXT_PUBLIC_UMAMI_URL — origin (no trailing slash), e.g. https://analytics.plansync.dev
 * NEXT_PUBLIC_UMAMI_WEBSITE_ID — UUID from Umami → website → tracking code
 */
export function UmamiAnalytics() {
  const base = process.env.NEXT_PUBLIC_UMAMI_URL?.trim().replace(/\/$/, "");
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!base || !websiteId) return null;

  return (
    <Script src={`${base}/script.js`} strategy="afterInteractive" data-website-id={websiteId} />
  );
}

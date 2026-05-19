import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";
import { getHomepageJsonLd } from "@/lib/landingJsonLd";
import { getSiteOrigin } from "@/lib/siteUrl";

const shareTitle =
  "PlanSync — Construction + datacenter platform | Free PDF viewer and orchestration workflows";
const shareDescription =
  "PlanSync connects drawings, issues, RFIs, and datacenter operations workflows. Start with a free PDF viewer: calibrate scale, measure, annotate, and export — no sign-up required.";

export const metadata: Metadata = {
  title: shareTitle,
  description: shareDescription,
  keywords: [
    "free PDF viewer",
    "free construction PDF viewer",
    "measure PDF online free",
    "PDF takeoff tool free",
    "blueprint viewer online free",
    "calibrate PDF scale",
    "construction drawing viewer",
    "markup PDF free",
    "architectural PDF viewer",
    "shop drawing viewer browser",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: shareTitle,
    description: shareDescription,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: shareTitle,
    description: shareDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function Home() {
  const origin = getSiteOrigin();
  const jsonLd = getHomepageJsonLd(origin);

  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/images/cta/CTA-constraction-hero.webp"
        fetchPriority="high"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}

import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";
import { getHomepageJsonLd } from "@/lib/landingJsonLd";
import { getSiteOriginFromRequest, SITE_SHARE_IMAGE } from "@/lib/siteUrl";

const shareTitle = "PlanSync — Digital Delivery Platform for Data Centers";
const shareDescription =
  "From BIM to operations — connect drawings, assets, commissioning, and O&M in one facility workspace for data-center delivery.";

export const metadata: Metadata = {
  title: shareTitle,
  description: shareDescription,
  keywords: [
    "data center BIM",
    "data center digital twin",
    "data center commissioning",
    "data center asset management",
    "BIM to operations",
    "data center construction",
    "data center facility management",
    "IFC BIM viewer",
    "data center O&M",
    "digital delivery platform",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: shareTitle,
    description: shareDescription,
    url: "/",
    type: "website",
    siteName: "PlanSync",
    images: [
      {
        url: SITE_SHARE_IMAGE.path,
        width: SITE_SHARE_IMAGE.width,
        height: SITE_SHARE_IMAGE.height,
        type: SITE_SHARE_IMAGE.type,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlanSync — Digital Delivery for Data Centers",
    description:
      "Keep every data-center asset connected from BIM and drawings through commissioning, handover, and operations.",
    images: [SITE_SHARE_IMAGE.path],
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

export default async function Home() {
  const origin = await getSiteOriginFromRequest();
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

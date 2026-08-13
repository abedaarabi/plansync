import { LANDING_FAQ } from "@/lib/landingContent";

const SOFTWARE_DESCRIPTION =
  "PlanSync is the digital delivery platform for data centers — connecting BIM, drawings, assets, commissioning, and O&M into one facility workspace from construction through operations. Free browser PDF viewer available; Pro/Enterprise add collaboration, BIM/IFC, and operations workflows.";

/** FAQPage + WebSite + SoftwareApplication for homepage SEO (rich results + free-tool signals). */
export function getHomepageJsonLd(siteOrigin: string) {
  const faqEntities = LANDING_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteOrigin}/#organization`,
        name: "PlanSync",
        url: siteOrigin,
        logo: {
          "@type": "ImageObject",
          url: `${siteOrigin}/icons/icon-512.png`,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteOrigin}/#website`,
        url: siteOrigin,
        name: "PlanSync",
        description: SOFTWARE_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": `${siteOrigin}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "PlanSync",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        browserRequirements: "Requires JavaScript. Works in modern desktop and mobile browsers.",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description: SOFTWARE_DESCRIPTION,
        url: siteOrigin,
        featureList: [
          "Digital delivery platform for data-center BIM, drawings, and assets",
          "Browser IFC/BIM viewer alongside 2D plans",
          "Asset-linked drawings, documents, and O&M records",
          "Issues and RFIs tied to drawing locations",
          "O&M handover, maintenance, and FM workflows on Enterprise",
          "Free tier: local-only PDF processing; Team/Pro/Enterprise: optional encrypted cloud projects",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqEntities,
      },
    ],
  };
}

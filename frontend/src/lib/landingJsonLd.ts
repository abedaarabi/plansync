import { LANDING_FAQ } from "@/lib/landingContent";

const SOFTWARE_DESCRIPTION =
  "PlanSync: free browser-based construction PDF viewer with local files (calibrate, measure, annotate, export). Optional PlanSync Pro adds cloud projects, team collaboration, and Stripe billing — Free tier stays full-featured for local PDFs.";

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
          "Calibrate drawing scale from a known dimension",
          "Line, area, angle, and path measurements on PDFs",
          "Markup tools and export to PDF or PNG",
          "O&M handover workflows with asset records, inspections, and maintenance planning",
          "Work orders, tenant request intake, and FM dashboard visibility for operations teams",
          "Free tier: local-only processing on your device; Pro: optional encrypted cloud projects",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqEntities,
      },
    ],
  };
}

import type { Metadata } from "next";
import { PricingPageClient } from "@/components/landing/PricingPageClient";

const title = "Pricing for construction and FM teams · PlanSync";
const description =
  "Compare Free, Pro, and Enterprise pricing for PlanSync. Start with a free PDF viewer, then upgrade for team workflows and operations modules.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title,
    description,
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function PricingPage() {
  return <PricingPageClient />;
}

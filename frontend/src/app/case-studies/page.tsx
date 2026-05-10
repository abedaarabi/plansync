import type { Metadata } from "next";
import { CaseStudiesPageClient } from "@/components/landing/CaseStudiesPageClient";

const title = "Construction and FM case studies · PlanSync";
const description =
  "See how teams use PlanSync to reduce turnaround time, cut rework, and improve handover quality.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/case-studies",
  },
  openGraph: {
    title,
    description,
    url: "/case-studies",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function CaseStudiesPage() {
  return <CaseStudiesPageClient />;
}

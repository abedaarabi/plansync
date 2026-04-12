import type { Metadata } from "next";
import { SolutionsIndexPageClient } from "@/components/landing/SolutionsIndexPageClient";
import { LANDING_SOLUTIONS_SECTION } from "@/lib/landingContent";

const title = `${LANDING_SOLUTIONS_SECTION.title} · PlanSync`;
const description = LANDING_SOLUTIONS_SECTION.description;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/solutions",
  },
  openGraph: {
    title,
    description,
    url: "/solutions",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function SolutionsPage() {
  return <SolutionsIndexPageClient />;
}

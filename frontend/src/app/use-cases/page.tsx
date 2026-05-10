import type { Metadata } from "next";
import { UseCasesPageClient } from "@/components/landing/UseCasesPageClient";

const title = "Use cases for construction and FM teams · PlanSync";
const description =
  "Explore role-based PlanSync use cases for general contractors, subcontractors, owners, and facilities teams.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/use-cases",
  },
  openGraph: {
    title,
    description,
    url: "/use-cases",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function UseCasesPage() {
  return <UseCasesPageClient />;
}

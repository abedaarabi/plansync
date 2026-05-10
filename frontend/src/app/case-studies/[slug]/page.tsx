import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudySlugPageClient } from "@/components/landing/CaseStudySlugPageClient";
import { isLandingCaseStudySlug, LANDING_CASE_STUDIES } from "@/lib/marketingContent";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LANDING_CASE_STUDIES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isLandingCaseStudySlug(slug)) {
    return { title: "Case study" };
  }
  const title = `Case study · ${slug.split("-").join(" ")} · PlanSync`;
  return {
    title,
    description: "Outcome-focused PlanSync implementation case study.",
    alternates: {
      canonical: `/case-studies/${slug}`,
    },
    openGraph: {
      title,
      description: "Outcome-focused PlanSync implementation case study.",
      url: `/case-studies/${slug}`,
      type: "website",
    },
  };
}

export default async function CaseStudySlugPage({ params }: Props) {
  const { slug } = await params;
  if (!isLandingCaseStudySlug(slug)) {
    notFound();
  }
  return <CaseStudySlugPageClient slug={slug} />;
}

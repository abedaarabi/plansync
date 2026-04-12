import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SolutionSlugPageClient } from "@/components/landing/SolutionSlugPageClient";
import { getSolution, isSolutionSlug, LANDING_SOLUTION_SLUGS } from "@/lib/landingContent";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LANDING_SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getSolution(slug);
  if (!s) {
    return { title: "Solution" };
  }
  const title = `${s.title} · PlanSync`;
  return {
    title,
    description: s.description,
    alternates: {
      canonical: `/solutions/${slug}`,
    },
    openGraph: {
      title,
      description: s.description,
      url: `/solutions/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: s.description,
    },
  };
}

export default async function SolutionDetailPage({ params }: Props) {
  const { slug } = await params;
  if (!isSolutionSlug(slug)) {
    notFound();
  }
  return <SolutionSlugPageClient slug={slug} />;
}

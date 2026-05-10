import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UseCaseSlugPageClient } from "@/components/landing/UseCaseSlugPageClient";
import { isLandingUseCaseSlug, LANDING_USE_CASES } from "@/lib/marketingContent";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LANDING_USE_CASES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isLandingUseCaseSlug(slug)) {
    return { title: "Use case" };
  }
  const title = `Use case · ${slug.split("-").join(" ")} · PlanSync`;
  return {
    title,
    description: "Role-based workflow blueprint powered by PlanSync.",
    alternates: {
      canonical: `/use-cases/${slug}`,
    },
    openGraph: {
      title,
      description: "Role-based workflow blueprint powered by PlanSync.",
      url: `/use-cases/${slug}`,
      type: "website",
    },
  };
}

export default async function UseCaseSlugPage({ params }: Props) {
  const { slug } = await params;
  if (!isLandingUseCaseSlug(slug)) {
    notFound();
  }
  return <UseCaseSlugPageClient slug={slug} />;
}

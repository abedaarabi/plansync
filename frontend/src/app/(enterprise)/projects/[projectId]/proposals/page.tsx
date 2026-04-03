import type { Metadata } from "next";
import { ProjectProposalsClient } from "@/components/enterprise/ProjectProposalsClient";

export const metadata: Metadata = { title: "Proposals" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectProposalsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProjectProposalsClient projectId={projectId} />
    </div>
  );
}

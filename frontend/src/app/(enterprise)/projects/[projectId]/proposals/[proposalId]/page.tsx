import type { Metadata } from "next";
import { ProposalDetailClient } from "@/components/enterprise/ProposalDetailClient";

export const metadata: Metadata = { title: "Proposal" };

type Props = { params: Promise<{ projectId: string; proposalId: string }> };

export default async function ProposalDetailPage({ params }: Props) {
  const { projectId, proposalId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalDetailClient projectId={projectId} proposalId={proposalId} />
    </div>
  );
}

import type { Metadata } from "next";
import { ProposalDetailClient } from "@/components/enterprise/ProposalDetailClient";

export const metadata: Metadata = { title: "Proposal" };

type Props = { params: Promise<{ workspaceId: string; projectId: string; proposalId: string }> };

export default async function WorkspaceProposalDetailPage({ params }: Props) {
  const { workspaceId, projectId, proposalId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalDetailClient
        projectId={projectId}
        proposalId={proposalId}
        workspaceId={workspaceId}
      />
    </div>
  );
}

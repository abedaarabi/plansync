import type { Metadata } from "next";
import { ProposalDetailClient } from "@/components/enterprise/ProposalDetailClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Proposal" };

type Props = { params: Promise<{ workspaceId: string; projectId: string; proposalId: string }> };

export default async function WorkspaceProposalDetailPage({ params }: Props) {
  const { workspaceId, projectId, proposalId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProposalDetailClient
        projectId={projectId}
        proposalId={proposalId}
        workspaceId={workspaceId}
      />
    </EnterpriseCompactPageShell>
  );
}

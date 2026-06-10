import type { Metadata } from "next";
import { ProposalTemplatesClient } from "@/components/enterprise/ProposalTemplatesClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Proposal templates" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProposalTemplatesPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProposalTemplatesClient projectId={projectId} workspaceId={workspaceId} />
    </EnterpriseCompactPageShell>
  );
}

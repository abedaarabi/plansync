import type { Metadata } from "next";
import { ProposalTemplatesClient } from "@/components/enterprise/ProposalTemplatesClient";

export const metadata: Metadata = { title: "Proposal templates" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProposalTemplatesPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalTemplatesClient projectId={projectId} workspaceId={workspaceId} />
    </div>
  );
}

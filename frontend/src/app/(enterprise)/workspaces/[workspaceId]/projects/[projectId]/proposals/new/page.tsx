import type { Metadata } from "next";
import { ProposalNewWizard } from "@/components/enterprise/ProposalNewWizard";

export const metadata: Metadata = { title: "New proposal" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceNewProposalPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalNewWizard projectId={projectId} workspaceId={workspaceId} />
    </div>
  );
}

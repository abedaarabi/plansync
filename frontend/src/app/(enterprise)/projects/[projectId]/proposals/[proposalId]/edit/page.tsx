import type { Metadata } from "next";
import { ProposalNewWizard } from "@/components/enterprise/ProposalNewWizard";

export const metadata: Metadata = { title: "Edit proposal" };

type Props = { params: Promise<{ projectId: string; proposalId: string }> };

export default async function EditProposalPage({ params }: Props) {
  const { projectId, proposalId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalNewWizard projectId={projectId} existingProposalId={proposalId} />
    </div>
  );
}

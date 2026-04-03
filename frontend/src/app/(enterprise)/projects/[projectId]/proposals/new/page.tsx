import type { Metadata } from "next";
import { ProposalNewWizard } from "@/components/enterprise/ProposalNewWizard";

export const metadata: Metadata = { title: "New proposal" };

type Props = { params: Promise<{ projectId: string }> };

export default async function NewProposalPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalNewWizard projectId={projectId} />
    </div>
  );
}

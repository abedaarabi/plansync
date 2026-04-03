import type { Metadata } from "next";
import { ProposalTemplatesClient } from "@/components/enterprise/ProposalTemplatesClient";

export const metadata: Metadata = { title: "Proposal templates" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProposalTemplatesPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProposalTemplatesClient projectId={projectId} />
    </div>
  );
}

import type { Metadata } from "next";
import { ProposalTemplatesClient } from "@/components/enterprise/ProposalTemplatesClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Proposal templates" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProposalTemplatesPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProposalTemplatesClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

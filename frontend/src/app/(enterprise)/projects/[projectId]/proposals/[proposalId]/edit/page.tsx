import type { Metadata } from "next";
import { ProposalEditorWorkspace } from "@/components/enterprise/proposals/editor/ProposalEditorWorkspace";

export const metadata: Metadata = { title: "Edit proposal" };

type Props = { params: Promise<{ projectId: string; proposalId: string }> };

export default async function EditProposalPage({ params }: Props) {
  const { projectId, proposalId } = await params;
  return <ProposalEditorWorkspace projectId={projectId} existingProposalId={proposalId} />;
}

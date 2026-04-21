import type { Metadata } from "next";
import { ProposalEditorWorkspace } from "@/components/enterprise/proposals/editor/ProposalEditorWorkspace";

export const metadata: Metadata = { title: "Edit proposal" };

type Props = { params: Promise<{ workspaceId: string; projectId: string; proposalId: string }> };

export default async function WorkspaceEditProposalPage({ params }: Props) {
  const { workspaceId, projectId, proposalId } = await params;
  return (
    <ProposalEditorWorkspace
      projectId={projectId}
      workspaceId={workspaceId}
      existingProposalId={proposalId}
    />
  );
}

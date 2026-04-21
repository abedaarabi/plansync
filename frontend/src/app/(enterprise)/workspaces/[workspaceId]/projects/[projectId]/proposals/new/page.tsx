import type { Metadata } from "next";
import { ProposalEditorWorkspace } from "@/components/enterprise/proposals/editor/ProposalEditorWorkspace";

export const metadata: Metadata = { title: "New proposal" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceNewProposalPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return <ProposalEditorWorkspace projectId={projectId} workspaceId={workspaceId} />;
}

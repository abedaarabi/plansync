import type { Metadata } from "next";
import { ProposalEditorWorkspace } from "@/components/enterprise/proposals/editor/ProposalEditorWorkspace";

export const metadata: Metadata = { title: "New proposal" };

type Props = { params: Promise<{ projectId: string }> };

export default async function NewProposalPage({ params }: Props) {
  const { projectId } = await params;
  return <ProposalEditorWorkspace projectId={projectId} />;
}

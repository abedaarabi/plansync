import type { Metadata } from "next";
import { ProjectProposalsClient } from "@/components/enterprise/ProjectProposalsClient";

export const metadata: Metadata = { title: "Proposals" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProjectProposalsPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <ProjectProposalsClient projectId={projectId} workspaceId={workspaceId} />
    </div>
  );
}

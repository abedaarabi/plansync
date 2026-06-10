import type { Metadata } from "next";
import { ProjectProposalsClient } from "@/components/enterprise/ProjectProposalsClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Proposals" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProjectProposalsPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectProposalsClient projectId={projectId} workspaceId={workspaceId} />
    </EnterpriseCompactPageShell>
  );
}

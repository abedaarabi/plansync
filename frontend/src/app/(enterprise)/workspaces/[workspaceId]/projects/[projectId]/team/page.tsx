import { ProjectTeamClient } from "@/components/enterprise/ProjectTeamClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProjectTeamPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectTeamClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

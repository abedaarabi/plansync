import { ProjectTeamClient } from "@/components/enterprise/ProjectTeamClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectTeamPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectTeamClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

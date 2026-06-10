import { ProjectDashboardClient } from "@/components/enterprise/ProjectDashboardClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectHomePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="7xl">
      <ProjectDashboardClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

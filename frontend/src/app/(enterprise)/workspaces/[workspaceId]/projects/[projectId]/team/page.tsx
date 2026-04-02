import { ProjectTeamClient } from "@/components/enterprise/ProjectTeamClient";

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProjectTeamPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectTeamClient projectId={projectId} />
      </div>
    </div>
  );
}

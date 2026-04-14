import { ProjectDashboardClient } from "@/components/enterprise/ProjectDashboardClient";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectHomePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in min-w-0 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl min-w-0">
        <ProjectDashboardClient projectId={projectId} />
      </div>
    </div>
  );
}

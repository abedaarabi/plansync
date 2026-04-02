import { ProjectDashboardClient } from "@/components/enterprise/ProjectDashboardClient";

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectHomePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <ProjectDashboardClient projectId={projectId} />
      </div>
    </div>
  );
}

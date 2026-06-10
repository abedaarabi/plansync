import type { Metadata } from "next";
import { ProjectReportsClient } from "@/components/enterprise/ProjectReportsClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Field Reports" };

export default async function ProjectReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectReportsClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

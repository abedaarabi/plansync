import type { Metadata } from "next";
import { ProjectRfisClient } from "@/components/enterprise/ProjectRfisClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "RFIs" };

export default async function ProjectRfiPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectRfisClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

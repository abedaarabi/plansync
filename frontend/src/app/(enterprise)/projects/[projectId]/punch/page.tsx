import type { Metadata } from "next";
import { ProjectPunchClient } from "@/components/enterprise/ProjectPunchClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Punch List" };

export default async function ProjectPunchPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectPunchClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

import type { Metadata } from "next";
import { ProjectTakeoffClient } from "@/components/enterprise/ProjectTakeoffClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Quantity Takeoff" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectTakeoffPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="7xl">
      <ProjectTakeoffClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

import type { Metadata } from "next";
import { ProjectTakeoffClient } from "@/components/enterprise/ProjectTakeoffClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Quantity Takeoff" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceProjectTakeoffPage({ params }: Props) {
  const { workspaceId, projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="7xl">
      <ProjectTakeoffClient projectId={projectId} workspaceId={workspaceId} />
    </EnterpriseCompactPageShell>
  );
}

import type { Metadata } from "next";
import { ProjectScheduleClient } from "@/components/enterprise/ProjectScheduleClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Schedule Beta" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectSchedulePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="1600">
      <ProjectScheduleClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

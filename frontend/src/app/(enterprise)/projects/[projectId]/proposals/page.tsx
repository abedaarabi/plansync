import type { Metadata } from "next";
import { ProjectProposalsClient } from "@/components/enterprise/ProjectProposalsClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Proposals" };

type Props = { params: Promise<{ projectId: string }> };

export default async function ProjectProposalsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <ProjectProposalsClient projectId={projectId} />
    </EnterpriseCompactPageShell>
  );
}

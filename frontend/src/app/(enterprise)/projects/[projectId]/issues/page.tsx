import type { Metadata } from "next";
import { ProjectIssuesClient } from "@/components/enterprise/ProjectIssuesClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Issues" };

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ issueKind?: string }>;
};

export default async function ProjectIssuesPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const sp = await searchParams;
  const raw = sp.issueKind?.trim();
  const issueKind =
    raw === "CONSTRUCTION" || raw === "WORK_ORDER" || raw === "OCCUPANT" ? raw : undefined;
  const listTitle =
    issueKind === "CONSTRUCTION"
      ? "Issues"
      : issueKind === "OCCUPANT"
        ? "Occupant inbox"
        : "Issues";

  return (
    <EnterpriseCompactPageShell>
      <ProjectIssuesClient
        projectId={projectId}
        issueKindFilter={issueKind}
        listTitle={listTitle}
      />
    </EnterpriseCompactPageShell>
  );
}

import type { Metadata } from "next";
import { ProjectIssuesClient } from "@/components/enterprise/ProjectIssuesClient";

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
      ? "Construction issues"
      : issueKind === "OCCUPANT"
        ? "Occupant inbox"
        : "Issues";

  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectIssuesClient
          projectId={projectId}
          issueKindFilter={issueKind}
          listTitle={listTitle}
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ProjectIssuesClient } from "@/components/enterprise/ProjectIssuesClient";

export const metadata: Metadata = { title: "Work orders" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmWorkOrdersPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <ProjectIssuesClient
          projectId={projectId}
          issueKindFilter="WORK_ORDER"
          listTitle="Work orders"
        />
      </div>
    </div>
  );
}

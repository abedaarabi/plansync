import type { Metadata } from "next";
import { IssueDetailClient } from "@/components/enterprise/IssueDetailClient";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";

export const metadata: Metadata = { title: "Issue Detail" };

type Props = { params: Promise<{ projectId: string; issueId: string }> };

export default async function IssueDetailPage({ params }: Props) {
  const { projectId, issueId } = await params;
  return (
    <EnterpriseCompactPageShell>
      <IssueDetailClient projectId={projectId} issueId={issueId} />
    </EnterpriseCompactPageShell>
  );
}

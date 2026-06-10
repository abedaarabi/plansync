import type { Metadata } from "next";
import { TenantRequestsClient } from "@/components/enterprise/TenantRequestsClient";

export const metadata: Metadata = { title: "Tenant request" };

type Props = { params: Promise<{ projectId: string; issueId: string }> };

export default async function OmTenantRequestDetailPage({ params }: Props) {
  const { projectId, issueId } = await params;
  return <TenantRequestsClient projectId={projectId} selectedIssueId={issueId} />;
}

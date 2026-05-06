import type { Metadata } from "next";
import { TenantRequestsClient } from "@/components/enterprise/TenantRequestsClient";

export const metadata: Metadata = { title: "Tenant request" };

type Props = { params: Promise<{ projectId: string; issueId: string }> };

export default async function OmTenantRequestDetailPage({ params }: Props) {
  const { projectId, issueId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <TenantRequestsClient projectId={projectId} selectedIssueId={issueId} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { TenantRequestsClient } from "@/components/enterprise/TenantRequestsClient";

export const metadata: Metadata = { title: "Occupant inbox" };

type Props = { params: Promise<{ projectId: string }> };

export default async function WorkspaceOmTenantRequestsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <TenantRequestsClient projectId={projectId} />
      </div>
    </div>
  );
}

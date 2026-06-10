import type { Metadata } from "next";
import { TenantRequestsClient } from "@/components/enterprise/TenantRequestsClient";

export const metadata: Metadata = { title: "Occupant inbox" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmTenantRequestsPage({ params }: Props) {
  const { projectId } = await params;
  return <TenantRequestsClient projectId={projectId} />;
}

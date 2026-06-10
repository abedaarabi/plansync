import type { Metadata } from "next";
import { OmTenantPortalClient } from "@/components/enterprise/OmTenantPortalClient";

export const metadata: Metadata = { title: "Occupant hub" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmTenantPortalPage({ params }: Props) {
  const { projectId } = await params;
  return <OmTenantPortalClient projectId={projectId} />;
}

import type { Metadata } from "next";
import { OmTenantPortalClient } from "@/components/enterprise/OmTenantPortalClient";

export const metadata: Metadata = { title: "Occupant hub" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmTenantPortalPage({ params }: Props) {
  const { projectId } = await params;
  return <OmTenantPortalClient projectId={projectId} />;
}

import type { Metadata } from "next";
import { OmMaintenanceClient } from "@/components/enterprise/OmMaintenanceClient";

export const metadata: Metadata = { title: "Maintenance" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmMaintenancePage({ params }: Props) {
  const { projectId } = await params;
  return <OmMaintenanceClient projectId={projectId} />;
}

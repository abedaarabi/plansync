import type { Metadata } from "next";
import { OmMaintenanceReportsClient } from "@/components/enterprise/OmMaintenanceReportsClient";

export const metadata: Metadata = { title: "Maintenance reports" };

type Props = { params: Promise<{ projectId: string }> };

export default async function WorkspaceOmReportsPage({ params }: Props) {
  const { projectId } = await params;
  return <OmMaintenanceReportsClient projectId={projectId} />;
}

import type { Metadata } from "next";
import { OmMaintenanceClient } from "@/components/enterprise/OmMaintenanceClient";

export const metadata: Metadata = { title: "Maintenance" };

type Props = { params: Promise<{ projectId: string }> };

export default async function OmMaintenancePage({ params }: Props) {
  const { projectId } = await params;
  return <OmMaintenanceClient projectId={projectId} />;
}

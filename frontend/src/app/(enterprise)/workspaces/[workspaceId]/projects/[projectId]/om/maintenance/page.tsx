import type { Metadata } from "next";
import { OmMaintenanceClient } from "@/components/enterprise/OmMaintenanceClient";

export const metadata: Metadata = { title: "Maintenance" };

type Props = { params: Promise<{ workspaceId: string; projectId: string }> };

export default async function WorkspaceOmMaintenancePage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="enterprise-animate-in p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <OmMaintenanceClient projectId={projectId} />
      </div>
    </div>
  );
}

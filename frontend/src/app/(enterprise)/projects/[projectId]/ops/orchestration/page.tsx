import type { Metadata } from "next";
import { DatacenterOpsClient } from "@/components/enterprise/DatacenterOpsClient";

export const metadata: Metadata = { title: "Datacenter orchestration" };

type Props = { params: Promise<{ projectId: string }> };

export default async function DatacenterOrchestrationPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mobile-app-page enterprise-animate-in w-full min-w-0 max-w-full px-4 pb-8 pt-3 sm:px-5 sm:pb-10 sm:pt-5 lg:px-8 lg:pb-12">
      <div className="mx-auto w-full max-w-full pb-[env(safe-area-inset-bottom,0px)] lg:max-w-6xl">
        <DatacenterOpsClient projectId={projectId} />
      </div>
    </div>
  );
}

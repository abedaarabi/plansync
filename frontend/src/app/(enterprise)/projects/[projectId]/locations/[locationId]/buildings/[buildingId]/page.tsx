import type { Metadata } from "next";
import { Suspense } from "react";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { BuildingDetailPageClient } from "@/components/enterprise/locations/BuildingDetailPageClient";

export const metadata: Metadata = { title: "Building" };

type Props = {
  params: Promise<{ projectId: string; locationId: string; buildingId: string }>;
};

export default async function BuildingDetailPage({ params }: Props) {
  const { projectId, locationId, buildingId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="1600">
      <Suspense fallback={<EnterpriseLoadingState label="Loading…" />}>
        <BuildingDetailPageClient
          projectId={projectId}
          locationId={locationId}
          buildingId={buildingId}
        />
      </Suspense>
    </EnterpriseCompactPageShell>
  );
}

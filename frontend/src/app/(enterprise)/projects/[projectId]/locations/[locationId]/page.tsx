import type { Metadata } from "next";
import { Suspense } from "react";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { BuildingsListClient } from "@/components/enterprise/locations/BuildingsListClient";

export const metadata: Metadata = { title: "Buildings" };

type Props = { params: Promise<{ projectId: string; locationId: string }> };

export default async function LocationBuildingsPage({ params }: Props) {
  const { projectId, locationId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="1600">
      <Suspense fallback={<EnterpriseLoadingState label="Loading…" />}>
        <BuildingsListClient projectId={projectId} locationId={locationId} />
      </Suspense>
    </EnterpriseCompactPageShell>
  );
}

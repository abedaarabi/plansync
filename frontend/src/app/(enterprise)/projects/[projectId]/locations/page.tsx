import type { Metadata } from "next";
import { Suspense } from "react";
import { EnterpriseCompactPageShell } from "@/components/enterprise/EnterpriseCompactPageShell";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { LocationsListClient } from "@/components/enterprise/locations/LocationsListClient";

export const metadata: Metadata = { title: "Locations" };

type Props = { params: Promise<{ projectId: string }> };

export default async function LocationsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <EnterpriseCompactPageShell maxWidth="1600">
      <Suspense fallback={<EnterpriseLoadingState label="Loading…" />}>
        <LocationsListClient projectId={projectId} />
      </Suspense>
    </EnterpriseCompactPageShell>
  );
}

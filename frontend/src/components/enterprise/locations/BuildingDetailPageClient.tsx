"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectSession } from "@/lib/api-client";
import { qk } from "@/lib/queryKeys";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { BuildingDetailClient } from "./BuildingDetailClient";

type Props = { projectId: string; locationId: string; buildingId: string };

export function BuildingDetailPageClient({ projectId, locationId, buildingId }: Props) {
  const { data: session, isPending } = useQuery({
    queryKey: qk.projectSession(projectId),
    queryFn: () => fetchProjectSession(projectId),
  });

  if (isPending || !session) return <EnterpriseLoadingState label="Loading building…" />;

  return (
    <BuildingDetailClient
      projectId={projectId}
      locationId={locationId}
      buildingId={buildingId}
      workspaceId={session.workspaceId}
    />
  );
}

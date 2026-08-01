import type { Metadata } from "next";
import { MatchDrawingPageClient } from "@/components/enterprise/locations/MatchDrawingPageClient";

export const metadata: Metadata = { title: "Register drawing" };

type Props = {
  params: Promise<{
    projectId: string;
    locationId: string;
    buildingId: string;
    levelId: string;
    assetId: string;
  }>;
};

export default async function MatchDrawingPage({ params }: Props) {
  const { projectId, locationId, buildingId, levelId, assetId } = await params;
  const readOnly = assetId === "view";

  return (
    <MatchDrawingPageClient
      projectId={projectId}
      locationId={locationId}
      buildingId={buildingId}
      levelId={levelId}
      assetId={readOnly ? "" : assetId}
      readOnly={readOnly}
    />
  );
}

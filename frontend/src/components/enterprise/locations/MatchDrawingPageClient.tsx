"use client";

import { useEffect } from "react";
import { openBimViewer } from "@/lib/bim/openBimViewer";
import { buildWorkspaceHref } from "@/lib/locations/workspaceHref";
import { useBuildingAssetsQuery } from "@/lib/locations/useBuildingQueries";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
import { EnterpriseLoadingState } from "../EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "../EnterpriseWorkspaceContext";
import { PlanUpgradeCallout } from "../PlanUpgradeCallout";
import { MatchingWindowClient } from "./MatchingWindowClient";

type Props = {
  projectId: string;
  locationId: string;
  buildingId: string;
  levelId: string;
  assetId: string;
  readOnly: boolean;
};

/** Standalone match route — redirects into the BIM workspace when an IFC is ready. */
export function MatchDrawingPageClient({
  projectId,
  locationId,
  buildingId,
  levelId,
  assetId,
  readOnly,
}: Props) {
  const { primary, loading: workspaceLoading } = useEnterpriseWorkspace();
  const isProPlus = isWorkspaceProPlusClient(primary?.workspace);

  const { data: assetsData, isLoading } = useBuildingAssetsQuery(buildingId, {
    typeFilter: "ALL",
    disciplineFilter: "ALL",
  });

  const readyIfc = assetsData?.assets.find((a) => a.type === "IFC" && a.status === "READY") ?? null;

  useEffect(() => {
    if (!isProPlus || readOnly || isLoading || !readyIfc) return;
    const href = buildWorkspaceHref({
      fileId: readyIfc.id,
      fileName: readyIfc.fileName,
      projectId,
      buildingId,
      locationId,
      fileVersionId: readyIfc.fileVersionId,
      mode: "edit",
      alignLevelId: levelId,
      alignAssetId: assetId,
    });
    openBimViewer(href);
  }, [
    isProPlus,
    readOnly,
    isLoading,
    readyIfc,
    projectId,
    buildingId,
    locationId,
    levelId,
    assetId,
  ]);

  if (workspaceLoading) {
    return <EnterpriseLoadingState label="Loading workspace…" />;
  }

  if (!isProPlus) {
    return (
      <PlanUpgradeCallout
        feature="BIM drawing matching"
        detail="Upgrade to Pro to align PDFs to IFC levels in the BIM workspace."
      />
    );
  }

  if (readOnly) {
    return (
      <div className="mobile-viewport-pane flex min-h-0 flex-col overflow-hidden">
        <MatchingWindowClient
          projectId={projectId}
          locationId={locationId}
          buildingId={buildingId}
          levelId={levelId}
          assetId=""
          mode="view"
        />
      </div>
    );
  }

  if (isLoading || readyIfc) {
    return (
      <div className="mobile-viewport-pane flex min-h-0 flex-col overflow-hidden">
        <EnterpriseLoadingState label="Opening workspace…" />
      </div>
    );
  }

  return (
    <div className="mobile-viewport-pane flex min-h-0 flex-col overflow-hidden">
      <MatchingWindowClient
        projectId={projectId}
        locationId={locationId}
        buildingId={buildingId}
        levelId={levelId}
        assetId={assetId}
      />
    </div>
  );
}

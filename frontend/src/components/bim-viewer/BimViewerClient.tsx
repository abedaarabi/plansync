"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { parseFederationMembers, type BimFederationMember } from "@/lib/bim/federation";
import { parseBuildingWorkspaceMode } from "@/lib/locations/workspaceHref";
import { QueryProvider } from "@/providers/QueryProvider";
import { BimBootLoadingFromUrl } from "./BimLoadingOverlay";

/**
 * Client bootstrap for `/bim-viewer?fileId=…&projectId=…` (optional `version`,
 * `fileVersionId`, `name`, `guid`, `issueId`, `compareFileVersionId`, `models`,
 * `buildingId` + `mode=work|edit`). The shell is client-only.
 */
const BimViewerShell = dynamic(() => import("./BimViewerShell").then((m) => m.BimViewerShell), {
  ssr: false,
  loading: () => <BimBootLoadingFromUrl />,
});

export function BimViewerClient() {
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const name = searchParams.get("name");
  const projectId = searchParams.get("projectId");
  const version = searchParams.get("version");
  const fileVersionId = searchParams.get("fileVersionId");
  const initialGuid = searchParams.get("guid");
  const compareFileVersionId = searchParams.get("compareFileVersionId");
  const modelsParam = searchParams.get("models");
  const issueId = searchParams.get("issueId");
  const buildingId = searchParams.get("buildingId");
  const locationId = searchParams.get("locationId");
  const levelId = searchParams.get("levelId");
  const viewParam = searchParams.get("view");
  const initialView = viewParam === "plan" || viewParam === "3d" ? viewParam : null;
  const alignLevelId = searchParams.get("alignLevelId");
  const alignAssetId = searchParams.get("alignAssetId");
  const workspaceMode = buildingId
    ? parseBuildingWorkspaceMode(searchParams.get("mode"), {
        alignActive: Boolean(alignLevelId && alignAssetId),
      })
    : null;

  const federationMembers = useMemo((): BimFederationMember[] => {
    if (!fileId) return [];
    const primary: BimFederationMember = {
      fileId,
      fileVersionId: fileVersionId ?? "",
      version,
      name: name ? decodeURIComponent(name) : "Model.ifc",
    };
    return parseFederationMembers(primary, modelsParam);
  }, [fileId, fileVersionId, version, name, modelsParam]);

  const sessionKey = `${fileId}:${fileVersionId ?? ""}`;

  if (!fileId) {
    return (
      <QueryProvider>
        <div className="bim-viewer flex h-dvh flex-col items-center justify-center gap-2 px-6">
          <p className="text-[14px] font-medium text-[var(--bim-text)]">No model selected</p>
          <p className="text-center text-[12px] text-[var(--bim-text-muted)]">
            Open an IFC file from your project&apos;s Files &amp; Drawings.
          </p>
        </div>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
      <BimViewerShell
        key={sessionKey}
        fileId={fileId}
        fileName={name ? decodeURIComponent(name) : "Model.ifc"}
        projectId={projectId}
        version={version}
        fileVersionId={fileVersionId}
        initialGuid={initialGuid}
        issueId={issueId}
        compareFileVersionId={compareFileVersionId}
        federationMembers={federationMembers}
        collabEnabled={false}
        buildingId={buildingId}
        locationId={locationId}
        workspaceMode={workspaceMode}
        initialLevelId={levelId}
        initialView={initialView}
        alignLevelId={alignLevelId}
        alignAssetId={alignAssetId}
      />
    </QueryProvider>
  );
}

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, fetchProjectSession } from "@/lib/api-client";
import { parseFederationMembers, type BimFederationMember } from "@/lib/bim/federation";
import { parseBuildingWorkspaceMode } from "@/lib/locations/workspaceHref";
import { qk } from "@/lib/queryKeys";
import { isWorkspaceProPlusClient } from "@/lib/workspaceSubscription";
import { QueryProvider } from "@/providers/QueryProvider";
import { BimBootLoadingFromUrl } from "./BimLoadingOverlay";

/**
 * Client bootstrap for `/bim-viewer?fileId=…&projectId=…` (optional `version`,
 * `fileVersionId`, `name`, `guid` / `guids`, `issueId`, `compareFileVersionId`, `models`,
 * `buildingId` + `mode=work|edit`). The shell is client-only.
 */
const BimViewerShell = dynamic(() => import("./BimViewerShell").then((m) => m.BimViewerShell), {
  ssr: false,
  loading: () => <BimBootLoadingFromUrl />,
});

function BimProPlusGate({
  projectId,
  children,
}: {
  projectId: string | null;
  children: ReactNode;
}) {
  const { data: me, isPending: mePending } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
  });
  const { data: session, isPending: sessionPending } = useQuery({
    queryKey: qk.projectSession(projectId ?? ""),
    queryFn: () => fetchProjectSession(projectId!),
    enabled: Boolean(projectId),
  });

  if (mePending || (projectId && sessionPending)) {
    return <BimBootLoadingFromUrl />;
  }

  const membership = projectId
    ? me?.workspaces.find((m) => m.workspace.id === session?.workspaceId)
    : undefined;
  const allowed = membership
    ? isWorkspaceProPlusClient(membership.workspace)
    : Boolean(me?.workspaces.some((m) => isWorkspaceProPlusClient(m.workspace)));

  if (!allowed) {
    return (
      <div className="bim-viewer flex h-dvh flex-col items-center justify-center gap-3 px-6">
        <p className="text-[14px] font-medium text-[var(--bim-text)]">BIM requires Pro</p>
        <p className="max-w-sm text-center text-[12px] text-[var(--bim-text-muted)]">
          Upgrade this workspace to Pro or Enterprise to open IFC models and clash detection.
        </p>
        <Link
          href="/organization?tab=billing"
          className="rounded-lg bg-[var(--bim-accent)] px-3 py-2 text-[12px] font-semibold text-white"
        >
          View plans &amp; billing
        </Link>
      </div>
    );
  }

  return children;
}

export function BimViewerClient() {
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const name = searchParams.get("name");
  const projectId = searchParams.get("projectId");
  const version = searchParams.get("version");
  const fileVersionId = searchParams.get("fileVersionId");
  const initialGuid = searchParams.get("guid");
  const guidsParam = searchParams.get("guids");
  const initialGuids = useMemo(() => {
    const fromList = (guidsParam ?? "")
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    if (fromList.length > 0) return fromList;
    const single = initialGuid?.trim();
    return single ? [single] : null;
  }, [guidsParam, initialGuid]);
  const compareFileVersionId = searchParams.get("compareFileVersionId");
  const modelsParam = searchParams.get("models");
  const issueId = searchParams.get("issueId");
  const omAssetId = searchParams.get("omAssetId");
  const buildingId = searchParams.get("buildingId");
  const locationId = searchParams.get("locationId");
  const levelId = searchParams.get("levelId");
  const viewParam = searchParams.get("view");
  const initialView = viewParam === "plan" || viewParam === "3d" ? viewParam : null;
  const alignLevelId = searchParams.get("alignLevelId");
  const alignAssetId = searchParams.get("alignAssetId");
  const previewAssetId = searchParams.get("previewAssetId");
  const panel = searchParams.get("panel");
  const initialClashTestId = searchParams.get("testId");
  const initialClashId = searchParams.get("clashId");
  const workspaceMode = buildingId
    ? parseBuildingWorkspaceMode(searchParams.get("mode"), {
        alignActive: Boolean(alignLevelId && alignAssetId) || Boolean(previewAssetId),
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
      <BimProPlusGate projectId={projectId}>
        <BimViewerShell
          key={sessionKey}
          fileId={fileId}
          fileName={name ? decodeURIComponent(name) : "Model.ifc"}
          projectId={projectId}
          version={version}
          fileVersionId={fileVersionId}
          initialGuid={initialGuid}
          initialGuids={initialGuids}
          issueId={issueId}
          omAssetId={omAssetId}
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
          previewAssetId={previewAssetId}
          initialPanel={panel}
          initialClashTestId={initialClashTestId}
          initialClashId={initialClashId}
        />
      </BimProPlusGate>
    </QueryProvider>
  );
}

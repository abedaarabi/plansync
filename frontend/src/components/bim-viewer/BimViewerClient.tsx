"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { parseFederationMembers, type BimFederationMember } from "@/lib/bim/federation";
import { QueryProvider } from "@/providers/QueryProvider";

/**
 * Client bootstrap for `/bim-viewer?fileId=…&projectId=…` (optional `version`,
 * `fileVersionId`, `name`, `guid`, `issueId`, `compareFileVersionId`, `models`). The shell is client-only.
 */
function BimBootLoading({ message = "Loading 3D viewer…" }: { message?: string }) {
  return (
    <div className="bim-viewer flex h-dvh items-center justify-center">
      <div className="bim-loading-card flex flex-col items-center px-8 py-9 text-center">
        <div className="bim-loading-logo relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <span className="bim-loading-logo__ring" aria-hidden />
          <span className="bim-loading-logo__glow" aria-hidden />
          <Image
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="relative"
            style={{ width: 40, height: 40 }}
            priority
          />
        </div>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--bim-text-subtle)]">
          <span className="text-[var(--bim-text)]">Plan</span>
          <span className="text-[var(--bim-accent)]">Sync</span>
        </p>
        <p className="mt-3 text-[14px] font-semibold text-[var(--bim-text)]">{message}</p>
      </div>
    </div>
  );
}

const BimViewerShell = dynamic(() => import("./BimViewerShell").then((m) => m.BimViewerShell), {
  ssr: false,
  loading: () => <BimBootLoading />,
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
      />
    </QueryProvider>
  );
}

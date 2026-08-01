import { apiUrl } from "@/lib/api-url";
import { fetchResolvedFileRevision } from "@/lib/api-client";
import {
  fetchBimStatus,
  triggerBimConversion,
  uploadBimFragments,
} from "@/lib/api-client/bim-viewer";
import { fetchFragmentsForVersion } from "@/lib/bim/progressiveTileLoader";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import { buildModelId, type BimFederationMember } from "@/lib/bim/federation";
import {
  buildFragmentsCacheKey,
  readCachedFragments,
  writeCachedFragments,
} from "@/lib/bimFragmentsCache";
import { assertIfcBytesIntact } from "@/lib/bim/ifcBytes";

// fallow-ignore-next-line complexity
export async function resolveFederationMember(
  member: BimFederationMember,
  projectId: string | null,
): Promise<BimFederationMember> {
  if (member.fileVersionId) return member;
  const verN = member.version != null && member.version !== "" ? Number(member.version) : undefined;
  const resolved = await fetchResolvedFileRevision(
    member.fileId,
    verN != null && !Number.isNaN(verN) ? verN : undefined,
  );
  return {
    ...member,
    fileVersionId: resolved.fileVersionId,
    version: member.version ?? String(resolved.version),
  };
}

// fallow-ignore-next-line complexity
export async function loadFederationMember(
  engine: BimEngine,
  member: BimFederationMember,
  opts?: {
    fitView?: boolean;
    onConverting?: (fraction: number) => void;
  },
): Promise<void> {
  const resolved = member.fileVersionId ? member : await resolveFederationMember(member, null);
  const modelId = buildModelId(resolved);
  const cacheKey = buildFragmentsCacheKey(resolved.fileId, resolved.fileVersionId);

  const status = await fetchBimStatus(resolved.fileVersionId).catch(() => null);
  const conversionActive =
    status?.conversionStatus === "running" ||
    status?.conversionStatus === "summary_ready" ||
    status?.conversionStatus === "pending" ||
    status?.conversionStatus === "queued";
  if (
    !status ||
    status.conversionStatus === "failed" ||
    (!status.quantityIndexReady && !conversionActive)
  ) {
    void triggerBimConversion(resolved.fileVersionId).catch(() => undefined);
  }

  // Server fragments only exist after a prior viewer session uploaded them.
  if (status?.fragmentsReady) {
    try {
      const serverBuf = await fetchFragmentsForVersion(resolved.fileVersionId);
      if (serverBuf && serverBuf.byteLength > 0) {
        await engine.addFragments(serverBuf, resolved, { fitView: opts?.fitView ?? false });
        return;
      }
    } catch {
      /* fall through to client IFC conversion */
    }
  }

  const cached = await readCachedFragments(cacheKey);
  if (cached) {
    await engine.addFragments(cached, resolved, { fitView: opts?.fitView ?? false });
    void uploadBimFragments(resolved.fileVersionId, cached).catch(() => undefined);
    return;
  }

  const v =
    resolved.version != null && resolved.version !== ""
      ? `?version=${encodeURIComponent(resolved.version)}`
      : "";
  const res = await fetch(
    apiUrl(`/api/v1/files/${encodeURIComponent(resolved.fileId)}/content${v}`),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`Could not download ${resolved.name} (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assertIfcBytesIntact(bytes, resolved.name);
  const buffer = await engine.addIfc(bytes, resolved, {
    fitView: opts?.fitView ?? false,
    onProgress: opts?.onConverting,
  });
  void writeCachedFragments(cacheKey, buffer);
  void uploadBimFragments(resolved.fileVersionId, buffer).catch(() => undefined);
}

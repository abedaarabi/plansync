import { apiUrl } from "@/lib/api-url";
import { fetchResolvedFileRevision } from "@/lib/api-client";
import {
  fetchBimStatus,
  triggerBimConversion,
  uploadBimFragments,
} from "@/lib/api-client/bim-viewer";
import { fetchFragmentsForVersion } from "@/lib/bim/progressiveTileLoader";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import type { BimFederationMember } from "@/lib/bim/federation";
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

async function readResponseBytes(
  res: Response,
  onDownloading?: (fraction: number, bytesTotal: number | null) => void,
): Promise<Uint8Array> {
  const totalHeader = Number(res.headers.get("content-length"));
  const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
  if (!res.body || !onDownloading) {
    return new Uint8Array(await res.arrayBuffer());
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  onDownloading(0, total);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) {
      chunks.push(value);
      received += value.byteLength;
      if (total != null) {
        onDownloading(Math.min(0.99, received / total), total);
      } else {
        onDownloading(Math.min(0.9, received / (received + 2_000_000)), null);
      }
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onDownloading(1, total ?? received);
  return out;
}

// fallow-ignore-next-line complexity
export async function loadFederationMember(
  engine: BimEngine,
  member: BimFederationMember,
  opts?: {
    fitView?: boolean;
    onConverting?: (fraction: number) => void;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
  },
): Promise<void> {
  const resolved = member.fileVersionId ? member : await resolveFederationMember(member, null);
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
      opts?.onDownloading?.(0.15, null);
      const serverBuf = await fetchFragmentsForVersion(resolved.fileVersionId);
      if (serverBuf && serverBuf.byteLength > 0) {
        opts?.onDownloading?.(1, serverBuf.byteLength);
        await engine.addFragments(serverBuf, resolved, { fitView: opts?.fitView ?? false });
        return;
      }
    } catch {
      /* fall through to client IFC conversion */
    }
  }

  const cached = await readCachedFragments(cacheKey);
  if (cached) {
    opts?.onDownloading?.(1, cached.byteLength);
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
  const bytes = await readResponseBytes(res, opts?.onDownloading);
  assertIfcBytesIntact(bytes, resolved.name);
  const buffer = await engine.addIfc(bytes, resolved, {
    fitView: opts?.fitView ?? false,
    onProgress: opts?.onConverting,
  });
  void writeCachedFragments(cacheKey, buffer);
  void uploadBimFragments(resolved.fileVersionId, buffer).catch(() => undefined);
}

import { apiUrl } from "@/lib/api-url";
import { fetchResolvedFileRevision } from "@/lib/api-client";
import {
  fetchBimStatus,
  triggerBimConversion,
  uploadBimFragments,
} from "@/lib/api-client/bim-viewer";
import { loadFragmentsProgressive } from "@/lib/bim/progressiveTileLoader";
import {
  BIM_STALL_MS,
  BimLoadAbortedError,
  BimLoadStallError,
  fetchBinaryWithRetry,
  pollUntil,
} from "@/lib/bim/loadFetch";
import type { BimEngine } from "@/components/bim-viewer/bimEngine";
import type { BimFederationMember } from "@/lib/bim/federation";
import {
  buildFragmentsCacheKey,
  readCachedFragments,
  writeCachedFragments,
} from "@/lib/bimFragmentsCache";
import { assertIfcBytesIntact } from "@/lib/bim/ifcBytes";
import type { BimConversionStatus } from "@/lib/bim/types";

const FRAGMENTS_WAIT_MS = 12 * 60_000;
const CONVERT_STALL_MS = 45_000;

// fallow-ignore-next-line complexity
export async function resolveFederationMember(
  member: BimFederationMember,
  _projectId: string | null,
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

function conversionActive(status: BimConversionStatus | null): boolean {
  const s = status?.conversionStatus;
  return s === "running" || s === "summary_ready" || s === "pending" || s === "queued";
}

async function waitForServerFragments(
  fileVersionId: string,
  signal?: AbortSignal,
): Promise<BimConversionStatus | null> {
  let status = await fetchBimStatus(fileVersionId).catch(() => null);
  if (status?.fragmentsReady) return status;

  const shouldKick =
    !status ||
    status.conversionStatus === "failed" ||
    (!status.fragmentsReady && !conversionActive(status));
  if (shouldKick) {
    void triggerBimConversion(fileVersionId).catch(() => undefined);
  }

  status = await pollUntil(
    () => fetchBimStatus(fileVersionId).catch(() => status),
    (s) => {
      if (!s) return false;
      if (s.fragmentsReady) return true;
      if (s.conversionStatus === "failed") return true;
      // Still producing server geometry — keep waiting.
      if (s.pipelinePhase === "fragments" || conversionActive(s)) return false;
      // Index finished and geometry phase is not running — fall back to client convert.
      return s.conversionStatus === "ready";
    },
    { intervalMs: 2_500, timeoutMs: FRAGMENTS_WAIT_MS, signal },
  );
  return status;
}

async function loadFromServerTiles(
  engine: BimEngine,
  member: BimFederationMember,
  opts?: {
    fitView?: boolean;
    signal?: AbortSignal;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
    onFirstGeometry?: () => void | Promise<void>;
  },
): Promise<boolean> {
  const fileVersionId = member.fileVersionId;
  if (!fileVersionId) return false;

  let first = true;
  let loaded = 0;
  for await (const tile of loadFragmentsProgressive(fileVersionId, {
    fragmentsReady: true,
    signal: opts?.signal,
    onDownloading: opts?.onDownloading,
  })) {
    if (opts?.signal?.aborted) throw new BimLoadAbortedError();
    const isLast = tile.index >= tile.total - 1;
    await engine.addFragmentTile(tile.buffer, member, tile.tileId, {
      fitView: false,
      skipPostProcess: !first && !isLast,
    });
    loaded += 1;
    if (first) {
      first = false;
      await opts?.onFirstGeometry?.();
    }
  }
  if (loaded > 0) {
    if (opts?.fitView) await engine.fitToView();
    return true;
  }
  return false;
}

// fallow-ignore-next-line complexity
export async function loadFederationMember(
  engine: BimEngine,
  member: BimFederationMember,
  opts?: {
    fitView?: boolean;
    onConverting?: (fraction: number) => void;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
    onFirstGeometry?: () => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<void> {
  const resolved = member.fileVersionId ? member : await resolveFederationMember(member, null);
  const cacheKey = buildFragmentsCacheKey(resolved.fileId, resolved.fileVersionId);

  if (opts?.signal?.aborted) throw new BimLoadAbortedError();

  let status = await fetchBimStatus(resolved.fileVersionId).catch(() => null);
  if (!status?.fragmentsReady) {
    status = await waitForServerFragments(resolved.fileVersionId!, opts?.signal);
  }

  if (status?.fragmentsReady) {
    try {
      const ok = await loadFromServerTiles(engine, resolved, {
        fitView: opts?.fitView,
        signal: opts?.signal,
        onDownloading: opts?.onDownloading,
        onFirstGeometry: opts?.onFirstGeometry,
      });
      if (ok) return;
    } catch (err) {
      if (err instanceof BimLoadAbortedError) throw err;
      if (err instanceof BimLoadStallError) throw err;
      /* fall through to cache / client IFC */
    }
  }

  const cached = await readCachedFragments(cacheKey);
  if (cached) {
    opts?.onDownloading?.(1, cached.byteLength);
    await engine.addFragments(cached, resolved, { fitView: opts?.fitView ?? false });
    await opts?.onFirstGeometry?.();
    if (!status?.fragmentsReady) {
      void uploadBimFragments(resolved.fileVersionId!, cached).catch(() => undefined);
    }
    return;
  }

  // Last resort: download IFC and convert in the browser.
  const v =
    resolved.version != null && resolved.version !== ""
      ? `?version=${encodeURIComponent(resolved.version)}`
      : "";
  const { res, bytes } = await fetchBinaryWithRetry(
    apiUrl(`/api/v1/files/${encodeURIComponent(resolved.fileId)}/content${v}`),
    {
      signal: opts?.signal,
      onDownloading: opts?.onDownloading,
      stallMs: BIM_STALL_MS,
    },
  );
  if (!res.ok) throw new Error(`Could not download ${resolved.name} (${res.status}).`);
  assertIfcBytesIntact(bytes, resolved.name);

  let lastConvertAt = Date.now();
  let convertStallTimer: number | undefined;
  const armConvertStall = () => {
    if (convertStallTimer != null) window.clearTimeout(convertStallTimer);
    convertStallTimer = window.setTimeout(() => {
      /* stall checked around addIfc via race below */
    }, CONVERT_STALL_MS);
  };
  armConvertStall();

  const convertPromise = engine.addIfc(bytes, resolved, {
    fitView: opts?.fitView ?? false,
    onProgress: (fraction) => {
      lastConvertAt = Date.now();
      armConvertStall();
      opts?.onConverting?.(fraction);
    },
  });

  const stallPromise = new Promise<never>((_, reject) => {
    const tick = () => {
      if (opts?.signal?.aborted) {
        reject(new BimLoadAbortedError());
        return;
      }
      if (Date.now() - lastConvertAt > CONVERT_STALL_MS) {
        reject(new BimLoadStallError("Conversion stalled. Try again."));
        return;
      }
      convertStallTimer = window.setTimeout(tick, 5_000);
    };
    convertStallTimer = window.setTimeout(tick, 5_000);
    opts?.signal?.addEventListener("abort", () => reject(new BimLoadAbortedError()), {
      once: true,
    });
  });

  try {
    const buffer = await Promise.race([convertPromise, stallPromise]);
    await opts?.onFirstGeometry?.();
    void writeCachedFragments(cacheKey, buffer);
    void uploadBimFragments(resolved.fileVersionId!, buffer).catch(() => undefined);
  } finally {
    if (convertStallTimer != null) window.clearTimeout(convertStallTimer);
  }
}

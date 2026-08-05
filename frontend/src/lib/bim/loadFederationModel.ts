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
  CLIENT_IFC_PARSE_MAX_BYTES,
  BimLoadAbortedError,
  BimLoadStallError,
  BimServerProcessingRequiredError,
  fetchBinaryWithRetry,
  pollUntil,
  withTimeout,
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

/** Default wait for server fragments before considering client fallback. */
const FRAGMENTS_WAIT_MS = 3 * 60_000;
/** Extra wait budget for large IFCs (per 100 MiB of source). */
const FRAGMENTS_WAIT_EXTRA_PER_100MIB_MS = 90_000;
/** Hard ceiling for waiting on server conversion (then error + Retry). */
const FRAGMENTS_WAIT_MAX_MS = 8 * 60_000;
const CONVERT_STALL_MS = 45_000;
/** First tile / fragment import must finish or we surface Retry. */
const FIRST_GEOMETRY_TIMEOUT_MS = 90_000;

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

function statusToPrepareFraction(status: BimConversionStatus | null): number | null {
  if (!status) return null;
  if (status.fragmentsReady) return 1;
  const progress = status.indexProgress;
  if (progress != null && Number.isFinite(progress)) {
    // Server reports 0–100; cap under 1 so download phase can still advance.
    return Math.min(0.95, Math.max(0.02, progress / 100));
  }
  return null;
}

function sourceByteLength(status: BimConversionStatus | null): number | null {
  const n = status?.sourceByteLength;
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

function fragmentsWaitMs(status: BimConversionStatus | null): number {
  const bytes = sourceByteLength(status);
  if (bytes == null) return FRAGMENTS_WAIT_MS;
  const extraBlocks = Math.max(0, Math.ceil(bytes / (100 * 1024 * 1024)) - 1);
  return Math.min(
    FRAGMENTS_WAIT_MAX_MS,
    FRAGMENTS_WAIT_MS + extraBlocks * FRAGMENTS_WAIT_EXTRA_PER_100MIB_MS,
  );
}

function tooLargeForClientParse(status: BimConversionStatus | null, knownBytes?: number): boolean {
  const bytes = knownBytes ?? sourceByteLength(status);
  return bytes != null && bytes > CLIENT_IFC_PARSE_MAX_BYTES;
}

async function waitForServerFragments(
  fileVersionId: string,
  opts?: {
    signal?: AbortSignal;
    onPreparing?: (fraction: number | null) => void;
    timeoutMs?: number;
    memberName?: string;
  },
): Promise<BimConversionStatus | null> {
  let status = await fetchBimStatus(fileVersionId, { signal: opts?.signal }).catch(() => null);
  if (status?.fragmentsReady) return status;

  const shouldKick =
    !status ||
    status.conversionStatus === "failed" ||
    (!status.fragmentsReady && !conversionActive(status));
  if (shouldKick) {
    void triggerBimConversion(fileVersionId).catch(() => undefined);
  }

  const waitStarted = Date.now();
  const timeoutMs = opts?.timeoutMs ?? fragmentsWaitMs(status);
  const emitPreparing = (s: BimConversionStatus | null) => {
    const fromStatus = statusToPrepareFraction(s);
    if (fromStatus != null) {
      opts?.onPreparing?.(fromStatus);
      return;
    }
    // Soft estimate so large models aren't stuck with an indeterminate bar.
    const soft = Math.min(0.45, 0.04 + (Date.now() - waitStarted) / Math.max(timeoutMs, 1));
    opts?.onPreparing?.(soft);
  };
  emitPreparing(status);

  const label = opts?.memberName?.trim() || "Model";
  try {
    status = await pollUntil(
      () => fetchBimStatus(fileVersionId, { signal: opts?.signal }).catch(() => status),
      (s) => {
        if (!s) return false;
        if (s.fragmentsReady) return true;
        if (s.conversionStatus === "failed") return true;
        // Still producing server geometry — keep waiting.
        if (s.pipelinePhase === "fragments" || conversionActive(s)) return false;
        // Index finished and geometry phase is not running — fall back to client convert.
        return s.conversionStatus === "ready";
      },
      {
        intervalMs: 2_500,
        timeoutMs,
        signal: opts?.signal,
        onValue: emitPreparing,
        // Large models cannot fall through to browser convert — fail fast with Retry.
        throwOnTimeout: tooLargeForClientParse(status),
        timeoutMessage: `${label} is still processing on the server. Wait a bit, then retry.`,
      },
    );
  } catch (err) {
    if (err instanceof BimLoadStallError && tooLargeForClientParse(status)) {
      throw new BimServerProcessingRequiredError(err.message);
    }
    throw err;
  }
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
    const add = engine.addFragmentTile(tile.buffer, member, tile.tileId, {
      fitView: false,
      skipPostProcess: !first && !isLast,
    });
    // First tile runs full post-process; don't let a hung worker pin the overlay forever.
    if (first) {
      await withTimeout(add, FIRST_GEOMETRY_TIMEOUT_MS, {
        signal: opts?.signal,
        message: `Timed out loading ${member.name}. Try again.`,
      });
    } else {
      await add;
    }
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

function refuseClientParse(member: BimFederationMember, status: BimConversionStatus | null): never {
  const active = conversionActive(status) || status?.pipelinePhase === "fragments";
  if (active) {
    throw new BimServerProcessingRequiredError(
      `${member.name} is still being processed on the server. Large models cannot be converted in the browser — wait for processing to finish, then open again.`,
    );
  }
  if (status?.conversionStatus === "failed") {
    throw new BimServerProcessingRequiredError(
      `${member.name} is too large to convert in the browser, and server processing failed. Retry conversion from the file menu, then open again.`,
    );
  }
  throw new BimServerProcessingRequiredError(
    `${member.name} is too large to convert in the browser. Wait for server processing to finish, then try again.`,
  );
}

// fallow-ignore-next-line complexity
export async function loadFederationMember(
  engine: BimEngine,
  member: BimFederationMember,
  opts?: {
    fitView?: boolean;
    onConverting?: (fraction: number) => void;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
    /** Server is still building fragments — fraction 0–1 when known. */
    onPreparing?: (fraction: number | null) => void;
    onFirstGeometry?: () => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<void> {
  const resolved = member.fileVersionId ? member : await resolveFederationMember(member, null);
  const cacheKey = buildFragmentsCacheKey(resolved.fileId, resolved.fileVersionId);

  if (opts?.signal?.aborted) throw new BimLoadAbortedError();

  let status = await fetchBimStatus(resolved.fileVersionId, { signal: opts?.signal }).catch(
    () => null,
  );
  if (!status?.fragmentsReady) {
    status = await waitForServerFragments(resolved.fileVersionId!, {
      signal: opts?.signal,
      onPreparing: opts?.onPreparing,
      timeoutMs: fragmentsWaitMs(status),
      memberName: resolved.name,
    });
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
    await withTimeout(
      engine.addFragments(cached, resolved, { fitView: opts?.fitView ?? false }),
      FIRST_GEOMETRY_TIMEOUT_MS,
      {
        signal: opts?.signal,
        message: `Timed out loading ${resolved.name} from cache. Try again.`,
      },
    );
    await opts?.onFirstGeometry?.();
    if (!status?.fragmentsReady) {
      void uploadBimFragments(resolved.fileVersionId!, cached).catch(() => undefined);
    }
    return;
  }

  // Large IFCs must never hit the in-browser WASM path — it OOMs the tab.
  if (tooLargeForClientParse(status)) {
    refuseClientParse(resolved, status);
  }

  // Last resort (small/medium files only): download IFC and convert in a worker.
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

  if (tooLargeForClientParse(status, bytes.byteLength)) {
    refuseClientParse(resolved, status);
  }

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

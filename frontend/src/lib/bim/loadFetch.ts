/** Binary fetch helpers with timeout, retry, byte progress, and stall detection. */

const BIM_FETCH_TIMEOUT_MS = 120_000;
export const BIM_STALL_MS = 45_000;
const DEFAULT_RETRIES = 2;

export class BimLoadAbortedError extends Error {
  constructor(message = "Model load was cancelled.") {
    super(message);
    this.name = "BimLoadAbortedError";
  }
}

export class BimLoadStallError extends Error {
  constructor(message = "Loading stalled. Check your connection and try again.") {
    super(message);
    this.name = "BimLoadStallError";
  }
}

function mergeSignals(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (a && !b) return a;
  if (!a && b) return b;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a!.addEventListener("abort", onAbort, { once: true });
  b!.addEventListener("abort", onAbort, { once: true });
  if (a!.aborted || b!.aborted) controller.abort();
  return controller.signal;
}

// fallow-ignore-next-line complexity
async function readResponseBytes(
  res: Response,
  opts?: {
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
    signal?: AbortSignal;
    stallMs?: number;
  },
): Promise<Uint8Array> {
  const totalHeader = Number(res.headers.get("content-length"));
  const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
  const onDownloading = opts?.onDownloading;
  const stallMs = opts?.stallMs ?? BIM_STALL_MS;

  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onDownloading?.(1, total ?? buf.byteLength);
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastProgressAt = Date.now();
  onDownloading?.(0, total);

  try {
    for (;;) {
      if (opts?.signal?.aborted) throw new BimLoadAbortedError();
      const readPromise = reader.read();
      const { done, value } = await Promise.race([
        readPromise,
        new Promise<never>((_, reject) => {
          const wait = Math.max(1_000, stallMs - (Date.now() - lastProgressAt));
          const t = setTimeout(() => reject(new BimLoadStallError()), wait);
          opts?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              reject(new BimLoadAbortedError());
            },
            { once: true },
          );
        }),
      ]);
      if (done) break;
      if (value?.byteLength) {
        chunks.push(value);
        received += value.byteLength;
        lastProgressAt = Date.now();
        if (total != null) {
          onDownloading?.(Math.min(0.99, received / total), total);
        } else {
          onDownloading?.(Math.min(0.9, received / (received + 2_000_000)), null);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onDownloading?.(1, total ?? received);
  return out;
}

// fallow-ignore-next-line complexity
export async function fetchBinaryWithRetry(
  url: string,
  opts?: {
    credentials?: RequestCredentials;
    signal?: AbortSignal;
    timeoutMs?: number;
    retries?: number;
    onDownloading?: (fraction: number, bytesTotal: number | null) => void;
    stallMs?: number;
  },
): Promise<{ res: Response; bytes: Uint8Array }> {
  const retries = opts?.retries ?? DEFAULT_RETRIES;
  const timeoutMs = opts?.timeoutMs ?? BIM_FETCH_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts?.signal?.aborted) throw new BimLoadAbortedError();
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = mergeSignals(opts?.signal, timeout);
    try {
      const res = await fetch(url, {
        credentials: opts?.credentials ?? "include",
        signal,
      });
      if (res.status === 404) {
        return { res, bytes: new Uint8Array() };
      }
      if (!res.ok) {
        throw new Error(`Download failed (${res.status})`);
      }
      const bytes = await readResponseBytes(res, {
        onDownloading: opts?.onDownloading,
        signal: opts?.signal,
        stallMs: opts?.stallMs,
      });
      return { res, bytes };
    } catch (err) {
      lastError = err;
      if (err instanceof BimLoadAbortedError) throw err;
      if (opts?.signal?.aborted) throw new BimLoadAbortedError();
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Download failed.");
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new BimLoadAbortedError();
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new BimLoadAbortedError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Poll until predicate is true or timeout. */
export async function pollUntil<T>(
  fetchValue: () => Promise<T>,
  isDone: (value: T) => boolean,
  opts?: {
    intervalMs?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
    onValue?: (value: T) => void;
  },
): Promise<T> {
  const intervalMs = opts?.intervalMs ?? 2_000;
  const timeoutMs = opts?.timeoutMs ?? 10 * 60_000;
  const started = Date.now();
  let last = await fetchValue();
  opts?.onValue?.(last);
  if (isDone(last)) return last;
  while (Date.now() - started < timeoutMs) {
    await sleep(intervalMs, opts?.signal);
    last = await fetchValue();
    opts?.onValue?.(last);
    if (isDone(last)) return last;
  }
  return last;
}
